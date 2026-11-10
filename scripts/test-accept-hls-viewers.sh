#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
script="${repository_root}/scripts/accept-hls-viewers.sh"

expect_usage_failure() {
    local expected=$1
    shift
    local output

    if output=$("$@" 2>&1); then
        printf 'Expected command to fail: %q' "$1" >&2
        printf ' %q' "${@:2}" >&2
        printf '\n' >&2
        exit 1
    fi
    grep -F "${expected}" <<<"${output}" >/dev/null
}

expect_usage_failure 'Usage:' "${script}"
expect_usage_failure 'HLS_URL must use http:// or https://' \
    "${script}" 'rtsp://127.0.0.1/live.m3u8'
expect_usage_failure 'VIEWERS must be a positive integer' \
    "${script}" 'http://127.0.0.1/live.m3u8' zero
expect_usage_failure 'VIEWERS must not exceed 1000' \
    "${script}" 'http://127.0.0.1/live.m3u8' 1001
expect_usage_failure 'ACCEPT_HLS_TIMEOUT_SECONDS must be a positive integer' \
    env ACCEPT_HLS_TIMEOUT_SECONDS=0 \
    "${script}" 'http://127.0.0.1/live.m3u8' 1
expect_usage_failure 'HLS_URL cannot contain a fragment' \
    "${script}" 'http://127.0.0.1/live.m3u8#fragment' 1

printf '%s\n' 'HLS viewer acceptance argument tests passed.'
