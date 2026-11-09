#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
rtsp_base="${RESTREAMER_MEDIAMTX_RTSP_BASE:-rtsp://mediamtx:8554}"
webrtc_base="${RESTREAMER_MEDIAMTX_WEBRTC_BASE:-http://127.0.0.1:8889}"
probe_timeout_seconds="${ACCEPT_PROBE_TIMEOUT_SECONDS:-8}"

usage() {
    cat >&2 <<'EOF'
Usage: scripts/accept-relays.sh PATH [PATH ...]

Verify named MediaMTX publications from the deployed Restreamer stack. Each path
must expose a reachable WebRTC player endpoint and an RTSP stream that satisfies
accept-deployment.sh's startup and sustained-decode limits.

Environment:
  RESTREAMER_MEDIAMTX_RTSP_BASE    RTSP URL visible inside Restreamer
                                  (default: rtsp://mediamtx:8554)
  RESTREAMER_MEDIAMTX_WEBRTC_BASE  WebRTC HTTP URL visible to dashboard clients
                                  (default: http://127.0.0.1:8889)
  ACCEPT_RELAY_REPORT_FILE         Optional JSON report for RTSP relay probes

The ACCEPT_MAX_FIRST_FRAME_MS, ACCEPT_PROBE_TIMEOUT_SECONDS,
ACCEPT_SAMPLE_SECONDS, and ACCEPT_MIN_SAMPLE_FPS settings are forwarded to
accept-deployment.sh. Hardware verification is deliberately disabled here; run
the camera-input acceptance command once for that host before this relay gate.
EOF
    exit 64
}

[[ $# -gt 0 ]] || usage

if [[ ! "${probe_timeout_seconds}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'ACCEPT_PROBE_TIMEOUT_SECONDS must be a positive integer, got %q.\n' \
        "${probe_timeout_seconds}" >&2
    exit 64
fi

case "${rtsp_base}" in
    rtsp://*) ;;
    *)
        printf 'RESTREAMER_MEDIAMTX_RTSP_BASE must use rtsp://, got %q.\n' \
            "${rtsp_base}" >&2
        exit 64
        ;;
esac

case "${webrtc_base}" in
    http://*|https://*) ;;
    *)
        printf 'RESTREAMER_MEDIAMTX_WEBRTC_BASE must use http:// or https://, got %q.\n' \
            "${webrtc_base}" >&2
        exit 64
        ;;
esac

if [[ "${rtsp_base}" == *\?* || "${rtsp_base}" == *\#* ]]; then
    printf 'RESTREAMER_MEDIAMTX_RTSP_BASE cannot contain a query or fragment.\n' >&2
    exit 64
fi
if [[ "${webrtc_base}" == *\?* || "${webrtc_base}" == *\#* ]]; then
    printf 'RESTREAMER_MEDIAMTX_WEBRTC_BASE cannot contain a query or fragment.\n' >&2
    exit 64
fi

rtsp_base="${rtsp_base%/}"
webrtc_base="${webrtc_base%/}"
relay_paths=()
rtsp_sources=()
declare -A seen_paths=()

redact_url() {
    local value=$1
    if [[ "${value}" =~ ^(https?|rtsp)://[^/@]+@(.+)$ ]]; then
        value="${BASH_REMATCH[1]}://***@${BASH_REMATCH[2]}"
    fi
    printf '%s' "${value}"
}

for relay_path in "$@"; do
    if [[ ! "${relay_path}" =~ ^[A-Za-z0-9._~-]+(/[A-Za-z0-9._~-]+)*$ \
        || "/${relay_path}/" == *"/./"* \
        || "/${relay_path}/" == *"/../"* ]]; then
        printf "Invalid MediaMTX path %q; path segments cannot be '.' or '..'.\n" \
            "${relay_path}" >&2
        exit 64
    fi
    if [[ -n "${seen_paths[${relay_path}]:-}" ]]; then
        printf 'Duplicate MediaMTX path: %s\n' "${relay_path}" >&2
        exit 64
    fi
    seen_paths["${relay_path}"]=1
    relay_paths+=("${relay_path}")
    rtsp_sources+=("${rtsp_base}/${relay_path}")
done

probe_webrtc() {
    local index=$1
    local relay_path=$2
    local endpoint="${webrtc_base}/${relay_path}"
    local safe_endpoint
    safe_endpoint="$(redact_url "${endpoint}")"

    if ! curl --fail --silent \
        --max-time "${probe_timeout_seconds}" "${endpoint}" >/dev/null; then
        printf 'Relay %s WebRTC endpoint failed: %s\n' \
            "${index}" "${safe_endpoint}" >&2
        return 1
    fi
    printf 'Relay %s WebRTC endpoint passed: %s\n' "${index}" "${safe_endpoint}"
}

probe_pids=()
for ((index = 0; index < ${#relay_paths[@]}; index++)); do
    probe_webrtc "$((index + 1))" "${relay_paths[index]}" &
    probe_pids+=("$!")
done

failed=0
for probe_pid in "${probe_pids[@]}"; do
    if ! wait "${probe_pid}"; then
        failed=1
    fi
done
if (( failed != 0 )); then
    printf '%s\n' 'MediaMTX WebRTC relay acceptance failed.' >&2
    exit 1
fi

ACCEPT_VERIFY_HARDWARE=false \
ACCEPT_HARDWARE_BACKENDS='' \
ACCEPT_REPORT_FILE="${ACCEPT_RELAY_REPORT_FILE:-}" \
    "${repository_root}/scripts/accept-deployment.sh" "${rtsp_sources[@]}"

printf 'Validated %s named MediaMTX relay(s) over WebRTC and RTSP.\n' \
    "${#relay_paths[@]}"
printf '%s\n' 'MediaMTX relay acceptance passed.'
