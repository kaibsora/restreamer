#!/usr/bin/env bash
set -euo pipefail

container="${RESTREAMER_CONTAINER:-restreamer}"
base_url="${RESTREAMER_BASE_URL:-http://127.0.0.1:8080}"
max_first_frame_ms="${ACCEPT_MAX_FIRST_FRAME_MS:-1000}"
probe_timeout_seconds="${ACCEPT_PROBE_TIMEOUT_SECONDS:-8}"
verify_hardware="${ACCEPT_VERIFY_HARDWARE:-true}"

usage() {
    cat >&2 <<'EOF'
Usage: scripts/accept-deployment.sh SOURCE [SOURCE ...]

Probe real camera sources concurrently through the running Restreamer container.
Supported sources:
  rtsp://host/path       RTSP camera or relay
  http[s]://host/path    HTTP camera stream
  v4l2:/dev/videoN      USB/V4L2 camera mapped into the container

Environment:
  RESTREAMER_CONTAINER          Container name (default: restreamer)
  RESTREAMER_BASE_URL           API URL (default: http://127.0.0.1:8080)
  ACCEPT_MAX_FIRST_FRAME_MS     Per-camera limit (default: 1000)
  ACCEPT_PROBE_TIMEOUT_SECONDS  Hard probe timeout (default: 8)
  ACCEPT_VERIFY_HARDWARE        Run active GPU encoding checks (default: true)
EOF
    exit 64
}

[[ $# -gt 0 ]] || usage

for value_name in max_first_frame_ms probe_timeout_seconds; do
    value="${!value_name}"
    if [[ ! "${value}" =~ ^[1-9][0-9]*$ ]]; then
        printf '%s must be a positive integer, got %q.\n' \
            "${value_name}" "${value}" >&2
        exit 64
    fi
done

case "${verify_hardware}" in
    true|false) ;;
    *)
        printf 'ACCEPT_VERIFY_HARDWARE must be true or false, got %q.\n' \
            "${verify_hardware}" >&2
        exit 64
        ;;
esac

container_running=$(docker container inspect \
    --format '{{.State.Running}}' "${container}" 2>/dev/null || true)
if [[ "${container_running}" != true ]]; then
    printf 'Restreamer container %q is not running.\n' "${container}" >&2
    exit 1
fi

curl --fail --silent --show-error "${base_url%/}/api" >/dev/null

if [[ "${verify_hardware}" == true ]]; then
    printf '%s\n' 'Running active hardware-encode verification...'
    docker exec "${container}" restreamer-hardware-report --verify
fi

probe_source() {
    index=$1
    source=$2
    input_args=()

    case "${source}" in
        rtsp://*)
            input_args=(
                -rtsp_transport tcp
                -fflags nobuffer
                -flags low_delay
                -avioflags direct
                -analyzeduration 0
                -probesize 32
                -i "${source}"
            )
            ;;
        http://*|https://*)
            input_args=(
                -fflags nobuffer
                -flags low_delay
                -analyzeduration 0
                -probesize 32
                -i "${source}"
            )
            ;;
        v4l2:/dev/video*)
            input_args=(-f v4l2 -thread_queue_size 2 -i "${source#v4l2:}")
            ;;
        *)
            printf 'Camera %s has an unsupported source type.\n' "${index}" >&2
            return 1
            ;;
    esac

    started_ms=$(date +%s%3N)
    if ! MSYS_NO_PATHCONV=1 docker exec "${container}" \
        timeout "${probe_timeout_seconds}" \
        ffmpeg -hide_banner -loglevel error \
        "${input_args[@]}" \
        -map 0:v:0 -frames:v 1 -f null - >/dev/null 2>&1; then
        printf 'Camera %s did not produce a decoded frame within %ss.\n' \
            "${index}" "${probe_timeout_seconds}" >&2
        return 1
    fi

    finished_ms=$(date +%s%3N)
    elapsed_ms=$((finished_ms - started_ms))
    if (( elapsed_ms >= max_first_frame_ms )); then
        printf 'Camera %s first-frame readback took %sms (limit: %sms).\n' \
            "${index}" "${elapsed_ms}" "${max_first_frame_ms}" >&2
        return 1
    fi

    printf 'Camera %s first-frame readback: %sms\n' "${index}" "${elapsed_ms}"
}

probe_pids=()
camera_index=0
for source in "$@"; do
    camera_index=$((camera_index + 1))
    probe_source "${camera_index}" "${source}" &
    probe_pids+=("$!")
done

failed=0
for probe_pid in "${probe_pids[@]}"; do
    if ! wait "${probe_pid}"; then
        failed=1
    fi
done

if (( failed != 0 )); then
    printf '%s\n' 'Deployment camera acceptance failed.' >&2
    exit 1
fi

printf 'Validated %s real camera source(s) concurrently below %sms first-frame readback.\n' \
    "${camera_index}" "${max_first_frame_ms}"
printf '%s\n' 'Deployment camera acceptance passed.'
