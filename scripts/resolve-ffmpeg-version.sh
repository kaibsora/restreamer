#!/usr/bin/env bash

set -euo pipefail

requested_source="${1:-${FFMPEG_VERSION:-master}}"
requested_source="${requested_source:-master}"

release_index_url="${FFMPEG_RELEASE_INDEX_URL:-https://ffmpeg.org/releases/}"
tags_api_url="${FFMPEG_TAGS_API_URL:-https://api.github.com/repos/FFmpeg/FFmpeg/tags?per_page=100}"
master_api_url="${FFMPEG_MASTER_API_URL:-https://api.github.com/repos/FFmpeg/FFmpeg/commits/master}"
master_git_url="${FFMPEG_MASTER_GIT_URL:-https://github.com/FFmpeg/FFmpeg.git}"
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

resolve_master() {
	local sha=''
	local response=''

	if response="$(curl "${github_curl_args[@]}" "${master_api_url}")"; then
		sha="$(printf '%s' "${response}" | grep -oE '"sha"[[:space:]]*:[[:space:]]*"[0-9a-fA-F]{40}"' | head -n 1 | grep -oE '[0-9a-fA-F]{40}' || true)"
	fi

	if [[ -z "${sha}" ]]; then
		printf 'FFmpeg master API unavailable; checking the upstream Git ref.\n' >&2
		sha="$(git ls-remote "${master_git_url}" refs/heads/master 2>/dev/null | awk 'NR == 1 { print $1 }' || true)"
	fi

	if ! [[ "${sha}" =~ ^[0-9a-fA-F]{40}$ ]]; then
		echo 'Unable to resolve the current FFmpeg master commit from either upstream source.' >&2
		exit 1
	fi

	printf 'git-%s\n' "${sha,,}"
}

resolve_stable() {
	local version=''
	local release_index=''
	local tags_json=''

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
}

case "${requested_source}" in
	master)
		resolve_master
		;;
	stable)
		resolve_stable
		;;
	git-[0-9a-fA-F][0-9a-fA-F]*)
		sha="${requested_source#git-}"
		if ! [[ "${sha}" =~ ^[0-9a-fA-F]{40}$ ]]; then
			echo "Invalid FFmpeg Git source '${requested_source}'; expected git- followed by a full 40-character commit SHA." >&2
			exit 2
		fi
		printf 'git-%s\n' "${sha,,}"
		;;
	v[0-9]* | [0-9]*)
		version="${requested_source#v}"
		if ! [[ "${version}" =~ ^[0-9]+\.[0-9]+(\.[0-9]+)?$ ]]; then
			echo "Invalid FFmpeg release '${requested_source}'; expected master, stable, an exact release, or git-<40-character-sha>." >&2
			exit 2
		fi
		printf '%s\n' "${version}"
		;;
	*)
		echo "Invalid FFmpeg source '${requested_source}'; expected master, stable, an exact release, or git-<40-character-sha>." >&2
		exit 2
		;;
esac
