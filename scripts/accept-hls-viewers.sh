#!/usr/bin/env bash
set -euo pipefail

source_url=${1:-}
viewer_count=${2:-128}
request_timeout_seconds=${ACCEPT_HLS_TIMEOUT_SECONDS:-10}
forwarded_for=${ACCEPT_HLS_FORWARDED_FOR:-}

usage() {
    cat >&2 <<'EOF'
Usage: scripts/accept-hls-viewers.sh HLS_URL [VIEWERS]

Open VIEWERS concurrent Restreamer HLS sessions. Each simulated viewer follows
master/media playlists and downloads one media segment. The default is 128 viewers.

Environment:
  ACCEPT_HLS_TIMEOUT_SECONDS  Per-request timeout (default: 10)
  ACCEPT_HLS_FORWARDED_FOR    Optional client address supplied to a trusted local
                              reverse proxy or direct Compose test

This is a server/session acceptance probe, not a bandwidth benchmark. Supplying an
X-Forwarded-For value to an untrusted public endpoint should have no effect.
EOF
    exit 64
}

[[ -n "${source_url}" ]] || usage

case "${source_url}" in
    http://*|https://*) ;;
    *)
        printf 'HLS_URL must use http:// or https://, got %q.\n' "${source_url}" >&2
        exit 64
        ;;
esac

if [[ ! "${viewer_count}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'VIEWERS must be a positive integer, got %q.\n' "${viewer_count}" >&2
    exit 64
fi
if (( viewer_count > 1000 )); then
    printf 'VIEWERS must not exceed 1000, got %s.\n' "${viewer_count}" >&2
    exit 64
fi
if [[ ! "${request_timeout_seconds}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'ACCEPT_HLS_TIMEOUT_SECONDS must be a positive integer, got %q.\n' \
        "${request_timeout_seconds}" >&2
    exit 64
fi
if [[ "${source_url}" == *'#'* ]]; then
    printf '%s\n' 'HLS_URL cannot contain a fragment.' >&2
    exit 64
fi

first_playlist_uri() {
    awk '
        {
            sub(/\r$/, "")
        }
        length($0) != 0 && substr($0, 1, 1) != "#" {
            print
            exit
        }
    '
}

resolve_uri() {
    local base_url=$1
    local reference=$2
    local scheme
    local authority
    local clean_base

    case "${reference}" in
        http://*|https://*)
            printf '%s' "${reference}"
            return
            ;;
        //*)
            scheme=${base_url%%:*}
            printf '%s:%s' "${scheme}" "${reference}"
            return
            ;;
    esac

    if [[ "${base_url}" =~ ^(https?://[^/]+) ]]; then
        authority=${BASH_REMATCH[1]}
    else
        return 1
    fi

    if [[ "${reference}" == /* ]]; then
        printf '%s%s' "${authority}" "${reference}"
        return
    fi

    clean_base=${base_url%%\?*}
    printf '%s/%s' "${clean_base%/*}" "${reference}"
}

probe_viewer() {
    local viewer_index=$1
    local current_url=${source_url}
    local playlist
    local reference
    local next_url
    local session_seen=false
    local depth
    local -a curl_args=(
        --fail
        --silent
        --show-error
        --location
        --max-time "${request_timeout_seconds}"
        --header "User-Agent: restreamer-hls-acceptance/${viewer_index}"
    )

    if [[ -n "${forwarded_for}" ]]; then
        curl_args+=(--header "X-Forwarded-For: ${forwarded_for}")
    fi

    for depth in 1 2 3 4; do
        if ! playlist=$(curl "${curl_args[@]}" "${current_url}"); then
            printf 'HLS viewer %s could not read playlist depth %s.\n' \
                "${viewer_index}" "${depth}" >&2
            return 1
        fi
        if [[ "${playlist}" != *'#EXTM3U'* ]]; then
            printf 'HLS viewer %s received a non-HLS playlist at depth %s.\n' \
                "${viewer_index}" "${depth}" >&2
            return 1
        fi

        reference=$(first_playlist_uri <<<"${playlist}")
        if [[ -z "${reference}" ]]; then
            printf 'HLS viewer %s found no child playlist or media segment.\n' \
                "${viewer_index}" >&2
            return 1
        fi
        if ! next_url=$(resolve_uri "${current_url}" "${reference}"); then
            printf 'HLS viewer %s could not resolve a playlist URI.\n' \
                "${viewer_index}" >&2
            return 1
        fi
        if [[ "${next_url}" == *'session='* ]]; then
            session_seen=true
        fi

        if [[ "${next_url%%\?*}" == *.m3u8 ]]; then
            current_url=${next_url}
            continue
        fi

        if [[ "${session_seen}" != true ]]; then
            printf 'HLS viewer %s was not assigned a Restreamer session.\n' \
                "${viewer_index}" >&2
            return 1
        fi
        if ! curl "${curl_args[@]}" --output /dev/null "${next_url}"; then
            printf 'HLS viewer %s could not download its media segment.\n' \
                "${viewer_index}" >&2
            return 1
        fi
        return 0
    done

    printf 'HLS viewer %s exceeded the supported playlist nesting depth.\n' \
        "${viewer_index}" >&2
    return 1
}

probe_pids=()
for ((viewer = 1; viewer <= viewer_count; viewer++)); do
    probe_viewer "${viewer}" &
    probe_pids+=("$!")
done

failed=0
for probe_pid in "${probe_pids[@]}"; do
    if ! wait "${probe_pid}"; then
        failed=$((failed + 1))
    fi
done

if (( failed != 0 )); then
    printf '%s of %s concurrent HLS viewer probes failed.\n' \
        "${failed}" "${viewer_count}" >&2
    exit 1
fi

printf 'Validated %s concurrent HLS viewer sessions through a media segment.\n' \
    "${viewer_count}"
