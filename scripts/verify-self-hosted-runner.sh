#!/usr/bin/env bash

set -euo pipefail

if [[ -n "${GITHUB_ENV:-}" && -n "${RUNNER_TEMP:-}" ]]; then
	docker_config="${RUNNER_TEMP}/restreamer-docker-config"
	install -d -m 0700 "${docker_config}"
	user_plugin_directory="${HOME}/.docker/cli-plugins"
	if [[ -d "${user_plugin_directory}" ]]; then
		ln -sfn "${user_plugin_directory}" "${docker_config}/cli-plugins"
	fi
	printf 'DOCKER_CONFIG=%s\n' "${docker_config}" >> "${GITHUB_ENV}"
fi

for command in bash curl docker git; do
	if ! command -v "${command}" >/dev/null 2>&1; then
		printf 'Required runner command is missing: %s\n' "${command}" >&2
		exit 1
	fi
done

if [[ "$(uname -s)" != Linux ]]; then
	printf 'The unified image workflow requires a Linux runner, found: %s\n' \
		"$(uname -s)" >&2
	exit 1
fi

case "$(uname -m)" in
	x86_64 | amd64) ;;
	*)
		printf 'The current image target requires an x86-64 runner, found: %s\n' \
			"$(uname -m)" >&2
		exit 1
		;;
esac

if ! docker info >/dev/null 2>&1; then
	echo 'Docker Engine is unavailable to the self-hosted runner user.' >&2
	exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
	echo 'Docker Compose v2 is unavailable on the self-hosted runner.' >&2
	exit 1
fi

minimum_disk_gb="${RESTREAMER_MIN_RUNNER_DISK_GB:-40}"
if ! [[ "${minimum_disk_gb}" =~ ^[0-9]+$ ]]; then
	printf 'RESTREAMER_MIN_RUNNER_DISK_GB must be an integer, found: %s\n' \
		"${minimum_disk_gb}" >&2
	exit 1
fi

available_kb="$(df -Pk . | awk 'NR == 2 { print $4 }')"
required_kb=$((minimum_disk_gb * 1024 * 1024))
if (( available_kb < required_kb )); then
	printf 'Runner has %s GiB free; at least %s GiB is required.\n' \
		"$((available_kb / 1024 / 1024))" "${minimum_disk_gb}" >&2
	exit 1
fi

printf 'Self-hosted runner ready: %s, Docker %s, Compose %s, %s GiB free.\n' \
	"$(uname -m)" \
	"$(docker version --format '{{.Server.Version}}')" \
	"$(docker compose version --short)" \
	"$((available_kb / 1024 / 1024))"
