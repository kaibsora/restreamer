#!/usr/bin/env bash

set -euo pipefail

requested_version="${1:-${FFMPEG_VERSION:-}}"
if [[ -n "${requested_version}" ]]; then
	printf '%s\n' "${requested_version#v}"
	exit 0
fi

release_index_url="${FFMPEG_RELEASE_INDEX_URL:-https://ffmpeg.org/releases/}"
tags_api_url="${FFMPEG_TAGS_API_URL:-https://api.github.com/repos/FFmpeg/FFmpeg/tags?per_page=100}"
curl_args=(
	--fail
	--silent
	--show-error
	--connect-timeout "${FFMPEG_RESOLVE_CONNECT_TIMEOUT_SECONDS:-10}"
	--max-time "${FFMPEG_RESOLVE_MAX_TIME_SECONDS:-30}"
	--retry "${FFMPEG_RESOLVE_RETRIES:-2}"
	--retry-delay 2
	--retry-connrefused
)
github_curl_args=("${curl_args[@]}")
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
	github_curl_args+=(
		--header "Authorization: Bearer ${GITHUB_TOKEN}"
		--header 'Accept: application/vnd.github+json'
		--header 'X-GitHub-Api-Version: 2022-11-28'
	)
fi

select_latest_version() {
	awk -F. '
			{
				major = $1 + 0
				minor = $2 + 0
				patch = $3 + 0
				if (!found || major > best_major ||
					(major == best_major && minor > best_minor) ||
					(major == best_major && minor == best_minor && patch > best_patch)) {
					best = $0
					best_major = major
					best_minor = minor
					best_patch = patch
					found = 1
				}
			}
			END { if (found) print best }
		'
}

version=''
if release_index="$(curl "${curl_args[@]}" "${release_index_url}")"; then
	version="$(
		printf '%s' "${release_index}" \
			| grep -oE 'ffmpeg-[0-9]+\.[0-9]+(\.[0-9]+)?\.tar\.xz' \
			| sed -E 's/^ffmpeg-|\.tar\.xz$//g' \
			| select_latest_version || true
	)"
fi

if [[ -z "${version}" ]]; then
	printf 'FFmpeg release index unavailable; checking official GitHub tags.\n' >&2
	if tags_json="$(curl "${github_curl_args[@]}" "${tags_api_url}")"; then
		version="$(
			printf '%s' "${tags_json}" \
				| grep -oE '"name"[[:space:]]*:[[:space:]]*"n[0-9]+\.[0-9]+(\.[0-9]+)?"' \
				| sed -E 's/.*"n([0-9]+\.[0-9]+(\.[0-9]+)?)"/\1/' \
				| select_latest_version || true
		)"
	fi
fi

if [[ -z "${version}" ]]; then
	echo 'Unable to resolve the latest stable FFmpeg release from either upstream source.' >&2
	exit 1
fi

printf '%s\n' "${version}"
