#!/usr/bin/env bash
# Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
set -euo pipefail
[[ "${GITHUB_REF}" == refs/heads/main ]]
[[ "${ACCEPTED_DIGEST}" =~ ^sha256:[0-9a-f]{64}$ ]]
[[ "${EXPECTED_COMMIT}" =~ ^[0-9a-f]{40}$ ]]
tags=("${RELEASE_TAG}")
if [[ "${RELEASE_TAG}" =~ ^([1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$ ]]; then
  tags+=("${BASH_REMATCH[1]}.${BASH_REMATCH[2]}" "${BASH_REMATCH[1]}" latest)
elif [[ ! "${RELEASE_TAG}" =~ ^rc-[1-9][0-9]*$ ]]; then
  echo 'Release tag must be an exact stable version (1.0.0) or an immutable rc-N tag.' >&2
  exit 1
fi
git merge-base --is-ancestor "${EXPECTED_COMMIT}" HEAD
image="${IMAGE_REPOSITORY}@${ACCEPTED_DIGEST}"
docker pull "${image}"
label() { docker image inspect "${image}" --format "{{index .Config.Labels \"$1\"}}"; }
[[ "$(label org.opencontainers.image.revision)" == "${EXPECTED_COMMIT}" ]]
[[ "$(label io.restreamer.repository.branch)" == main ]]
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
tag_arguments=()
for tag in "${tags[@]}"; do tag_arguments+=(--tag "${IMAGE_REPOSITORY}:${tag}"); done
docker buildx imagetools create --prefer-index=false "${tag_arguments[@]}" "${image}"
for tag in "${tags[@]}"; do
  actual="$(docker buildx imagetools inspect "${IMAGE_REPOSITORY}:${tag}" --format '{{.Manifest.Digest}}')"
  [[ "${actual}" == "${ACCEPTED_DIGEST}" ]]
done
echo "Promoted ${image} to ${tags[*]} without rebuilding."
