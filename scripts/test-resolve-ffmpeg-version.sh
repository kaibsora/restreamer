#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/restreamer-ffmpeg-resolver-test.XXXXXX")"
trap 'rm -rf -- "${fixture_root}"' EXIT
mkdir -p "${fixture_root}/bin"

cat >"${fixture_root}/bin/curl" <<'EOF'
#!/bin/sh
case "${FAKE_CURL_MODE:-}" in
    primary)
        case "$*" in
            *ffmpeg.org/releases*)
                printf '%s\n' \
                    'ffmpeg-8.0.1.tar.xz' \
                    'ffmpeg-9.0.tar.xz' \
                    'ffmpeg-9.0.2.tar.xz'
                ;;
            *) exit 70 ;;
        esac
        ;;
    fallback)
        case "$*" in
            *ffmpeg.org/releases*) exit 28 ;;
            *api.github.com/repos/FFmpeg/FFmpeg/tags*)
                printf '%s\n' \
                    '[{"name":"n8.0.1"},{"name":"n9.0"},' \
                    '{"name":"n9.0.2"},{"name":"n9.1-dev"}]'
                ;;
            *) exit 70 ;;
        esac
        ;;
    *) exit 28 ;;
esac
EOF
chmod +x "${fixture_root}/bin/curl"

test_path="${fixture_root}/bin:/usr/bin:/bin"

version="$(PATH="${test_path}" FAKE_CURL_MODE=primary \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh")"
[[ "${version}" == 9.0.2 ]]

version="$(PATH="${test_path}" FAKE_CURL_MODE=fallback \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh")"
[[ "${version}" == 9.0.2 ]]

version="$(PATH="${test_path}" FAKE_CURL_MODE=unavailable \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" v7.1.1)"
[[ "${version}" == 7.1.1 ]]

if PATH="${test_path}" FAKE_CURL_MODE=unavailable \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" \
    >"${fixture_root}/failure" 2>&1; then
    printf '%s\n' 'Expected unavailable upstream release sources to fail.' >&2
    exit 1
fi
grep -F 'Unable to resolve the latest stable FFmpeg release from either upstream source.' \
    "${fixture_root}/failure" >/dev/null

printf '%s\n' 'FFmpeg release resolver fallback tests passed.'
