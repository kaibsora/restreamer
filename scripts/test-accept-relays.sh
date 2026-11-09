#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/restreamer-relay-test.XXXXXX")"
trap 'rm -rf -- "${fixture_root}"' EXIT

expect_failure() {
    local expected=$1
    shift
    if "$@" >"${fixture_root}/output" 2>&1; then
        printf 'Expected relay validation to fail: %s\n' "${expected}" >&2
        exit 1
    fi
    grep -F "${expected}" "${fixture_root}/output" >/dev/null
}

expect_failure 'Invalid MediaMTX path' \
    "${repository_root}/scripts/accept-relays.sh" '../camera'
expect_failure 'Invalid MediaMTX path' \
    "${repository_root}/scripts/accept-relays.sh" 'camera?token=secret'
expect_failure 'Duplicate MediaMTX path' \
    "${repository_root}/scripts/accept-relays.sh" camera camera
expect_failure 'RESTREAMER_MEDIAMTX_RTSP_BASE must use rtsp://' \
    env RESTREAMER_MEDIAMTX_RTSP_BASE=http://mediamtx:8554 \
    "${repository_root}/scripts/accept-relays.sh" camera
expect_failure 'RESTREAMER_MEDIAMTX_WEBRTC_BASE must use http:// or https://' \
    env RESTREAMER_MEDIAMTX_WEBRTC_BASE=rtsp://mediamtx:8889 \
    "${repository_root}/scripts/accept-relays.sh" camera
expect_failure 'ACCEPT_PROBE_TIMEOUT_SECONDS must be a positive integer' \
    env ACCEPT_PROBE_TIMEOUT_SECONDS=zero \
    "${repository_root}/scripts/accept-relays.sh" camera

printf '%s\n' 'MediaMTX relay acceptance validation tests passed.'
