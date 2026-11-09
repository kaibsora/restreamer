#!/usr/bin/env bash
set -euo pipefail

health_host="${RESTREAMER_HEALTH_HOST:-127.0.0.1}"
health_port="${RESTREAMER_HEALTH_PORT:-8080}"

if [[ ! "${health_port}" =~ ^[1-9][0-9]{0,4}$ ]] || (( health_port > 65535 )); then
    printf 'RESTREAMER_HEALTH_PORT must be between 1 and 65535, got %q.\n' \
        "${health_port}" >&2
    exit 64
fi

# Bash provides /dev/tcp without adding a second HTTP client to the image. The
# unauthenticated Core endpoint is intentionally narrow and reports readiness
# without depending on UI files, credentials, or a configured channel.
exec 3<>"/dev/tcp/${health_host}/${health_port}"
printf 'GET /ping HTTP/1.0\r\nHost: localhost\r\nConnection: close\r\n\r\n' >&3

IFS=' ' read -r protocol status _ <&3
status="${status%$'\r'}"

[[ "${protocol}" == HTTP/* && "${status}" == 200 ]]
