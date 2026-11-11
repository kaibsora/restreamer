#!/usr/bin/env bash
# Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
set -euo pipefail
[[ "${GITHUB_REF}" == refs/heads/2.x ]]
[[ "${ACCEPTED_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "${EXPECTED_COMMIT}" =~ ^[0-9a-f]{40}$ ]]
[[ "${RELEASE_TAG}" =~ ^rc-[1-9][0-9]*$ ]]
git merge-base --is-ancestor "${EXPECTED_COMMIT}" HEAD
image="${IMAGE_REPOSITORY}@${ACCEPTED_DIGEST}"
docker pull "${image}"
label() { docker image inspect "${image}" --format "{{index .Config.Labels \"$1\"}}"; }
[[ "$(label org.opencontainers.image.revision)" == "${EXPECTED_COMMIT}" ]]
[[ "$(label io.restreamer.repository.branch)" == 2.x ]]
[[ "$(label org.opencontainers.image.title)" == 'CQComber Restreamer' ]]
source="$(label io.cqcomber.ffmpeg.sources)"
[[ "${source}" == "${IMAGE_REPOSITORY}"@sha256:* ]]
docker manifest inspect "${source}" >/dev/null
docker run --rm --entrypoint sh "${image}" -c '
  test -s /usr/share/doc/cqcomber-restreamer/NOTICE &&
  test -s /usr/share/doc/ffmpeg/ffmpeg-patched-source.tar.xz &&
  test -s /usr/share/doc/ffmpeg/SOURCES.txt &&
  restreamer-verify-ffmpeg && restreamer-verify-hevc-hls
'
lookup_error="$(mktemp)"
trap 'rm -f -- "${lookup_error}"' EXIT
if existing="$(docker buildx imagetools inspect "${IMAGE_REPOSITORY}:${RELEASE_TAG}" --format '{{.Manifest.Digest}}' 2>"${lookup_error}")"; then
  [[ "${existing}" == "${ACCEPTED_DIGEST}" ]] || { echo 'Refusing to overwrite an existing release tag.' >&2; exit 1; }
elif ! grep -Eqi 'manifest unknown|: not found$' "${lookup_error}"; then
  cat "${lookup_error}" >&2
  echo 'Release tag lookup failed; refusing to treat a registry error as a missing tag.' >&2
  exit 1
fi
docker buildx imagetools create --prefer-index=false \
  --tag "${IMAGE_REPOSITORY}:${RELEASE_TAG}" --tag "${IMAGE_REPOSITORY}:latest" "${image}"
for tag in "${RELEASE_TAG}" latest; do
  actual="$(docker buildx imagetools inspect "${IMAGE_REPOSITORY}:${tag}" --format '{{.Manifest.Digest}}')"
  [[ "${actual}" == "${ACCEPTED_DIGEST}" ]]
done
echo "Promoted ${image} to ${RELEASE_TAG} and latest without rebuilding."
