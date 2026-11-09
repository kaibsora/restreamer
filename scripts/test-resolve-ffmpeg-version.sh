#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/restreamer-ffmpeg-resolver-test.XXXXXX")"
trap 'rm -rf -- "${fixture_root}"' EXIT
mkdir -p "${fixture_root}/bin"

master_sha='0123456789abcdef0123456789abcdef01234567'
fallback_sha='89abcdef0123456789abcdef0123456789abcdef'

cat >"${fixture_root}/bin/curl" <<'EOF'
#!/bin/sh
case "${FAKE_CURL_MODE:-}" in
    master)
        case "$*" in
            *api.github.com/repos/FFmpeg/FFmpeg/commits/master*)
                printf '%s\n' '{"sha":"0123456789abcdef0123456789abcdef01234567"}'
                ;;
            *) exit 70 ;;
        esac
        ;;
    stable-primary)
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
    stable-fallback)
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

cat >"${fixture_root}/bin/git" <<'EOF'
#!/usr/bin/env bash
if [[ "${FAKE_GIT_MODE:-}" == fallback && "$*" == *'ls-remote'* ]]; then
    printf '%s\t%s\n' '89abcdef0123456789abcdef0123456789abcdef' 'refs/heads/master'
    exit 0
fi
exit 70
EOF
chmod +x "${fixture_root}/bin/git"

test_path="${fixture_root}/bin:/usr/bin:/bin"

source="$(PATH="${test_path}" FAKE_CURL_MODE=master \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh")"
[[ "${source}" == "git-${master_sha}" ]]

source="$(PATH="${test_path}" FAKE_CURL_MODE=unavailable FAKE_GIT_MODE=fallback \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" master)"
[[ "${source}" == "git-${fallback_sha}" ]]

version="$(PATH="${test_path}" FAKE_CURL_MODE=stable-primary \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" stable)"
[[ "${version}" == 9.0.2 ]]

version="$(PATH="${test_path}" FAKE_CURL_MODE=stable-fallback \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" stable)"
[[ "${version}" == 9.0.2 ]]

version="$(PATH="${test_path}" FAKE_CURL_MODE=unavailable \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" v7.1.1)"
[[ "${version}" == 7.1.1 ]]

source="$(PATH="${test_path}" FAKE_CURL_MODE=unavailable \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" "git-${master_sha^^}")"
[[ "${source}" == "git-${master_sha}" ]]

if PATH="${test_path}" FAKE_CURL_MODE=unavailable FAKE_GIT_MODE=unavailable \
    "${repository_root}/scripts/resolve-ffmpeg-version.sh" master \
    >"${fixture_root}/failure" 2>&1; then
    printf '%s\n' 'Expected unavailable upstream master sources to fail.' >&2
    exit 1
fi
grep -F 'Unable to resolve the current FFmpeg master commit from either upstream source.' \
    "${fixture_root}/failure" >/dev/null

if PATH="${test_path}" "${repository_root}/scripts/resolve-ffmpeg-version.sh" \
    git-deadbeef >"${fixture_root}/invalid" 2>&1; then
    printf '%s\n' 'Expected a short Git commit to fail.' >&2
    exit 1
fi
grep -F 'expected git- followed by a full 40-character commit SHA' \
    "${fixture_root}/invalid" >/dev/null

printf '%s\n' 'FFmpeg source resolver tests passed.'
