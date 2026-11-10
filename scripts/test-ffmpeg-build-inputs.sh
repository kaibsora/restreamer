#!/usr/bin/env bash
set -euo pipefail
script="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/ffmpeg-build-inputs.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "${fixture}"' EXIT
cd "${fixture}"
git init -q
mkdir -p components/ffmpeg components/ui scripts
cp "${script}" scripts/ffmpeg-build-inputs.sh
printf 'FROM ubuntu:24.04\n' > components/ffmpeg/Dockerfile.ubuntu.hardware
printf 'master\n' > scripts/resolve-ffmpeg-version.sh
commit() {
    git add .
    git -c user.name=Test -c user.email=test@example.invalid commit -qm test
}
commit
original="$(bash scripts/ffmpeg-build-inputs.sh)"
[[ "${original}" =~ ^[0-9a-f]{16}$ ]]
printf 'UI change\n' > components/ui/index.js
commit
[[ "$(bash scripts/ffmpeg-build-inputs.sh)" == "${original}" ]]
printf 'RUN install-full-intel-runtime\n' >> components/ffmpeg/Dockerfile.ubuntu.hardware
commit
updated="$(bash scripts/ffmpeg-build-inputs.sh)"
[[ "${updated}" != "${original}" ]]
# A following UI-only commit must retain the new runtime identity even when
# the preceding runtime workflow was canceled before publishing its image.
printf 'Another UI change\n' >> components/ui/index.js
commit
[[ "$(bash scripts/ffmpeg-build-inputs.sh)" == "${updated}" ]]
printf 'stable\n' > scripts/resolve-ffmpeg-version.sh
commit
[[ "$(bash scripts/ffmpeg-build-inputs.sh)" != "${updated}" ]]
echo 'PASS: FFmpeg runtime identity tracks committed build inputs across consecutive pushes.'
