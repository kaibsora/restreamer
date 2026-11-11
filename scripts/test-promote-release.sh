#!/usr/bin/env bash
# Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
set -euo pipefail
script="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/promote-release.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "${fixture}"' EXIT
mkdir "${fixture}/bin"
export LOG="${fixture}/docker.log"
export IMAGE_REPOSITORY=ghcr.io/example/restreamer
export EXPECTED_COMMIT=1111111111111111111111111111111111111111
export ACCEPTED_DIGEST=sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa
export GITHUB_REF=refs/heads/2.x RELEASE_TAG=rc-1
export IMAGE_BRANCH=2.x EXISTING_DIGEST="${ACCEPTED_DIGEST}"
cat > "${fixture}/bin/git" <<'EOF'
#!/bin/sh
exit 0
EOF
cat > "${fixture}/bin/docker" <<'EOF'
#!/usr/bin/env bash
echo "$*" >> "${LOG}"
case "$*" in
  *org.opencontainers.image.revision*) echo "${EXPECTED_COMMIT}" ;;
  *io.restreamer.repository.branch*) echo "${IMAGE_BRANCH}" ;;
  *org.opencontainers.image.title*) echo 'CQComber Restreamer' ;;
  *io.cqcomber.ffmpeg.sources*) echo "${IMAGE_REPOSITORY}@${ACCEPTED_DIGEST}" ;;
  'buildx imagetools inspect'*) echo "${EXISTING_DIGEST}" ;;
esac
EOF
chmod +x "${fixture}/bin/"*
export PATH="${fixture}/bin:${PATH}"
GITHUB_REF=refs/heads/development bash "${script}" >/dev/null 2>&1 && exit 1
test ! -e "${LOG}"
IMAGE_BRANCH=development bash "${script}" >/dev/null 2>&1 && exit 1
! grep -q 'imagetools create' "${LOG}"
EXISTING_DIGEST=sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb bash "${script}" >/dev/null 2>&1 && exit 1
! grep -q 'imagetools create' "${LOG}"
bash "${script}" >/dev/null
test "$(grep -c 'imagetools create' "${LOG}")" -eq 1
echo 'PASS: development images and changed release tags cannot be promoted; accepted digest is promoted once.'
