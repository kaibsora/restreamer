#!/usr/bin/env bash
set -euo pipefail

backend="${1:-}"
render_device="${2:-}"
probe_image="${HARDWARE_PROBE_IMAGE:-docker.io/library/alpine:3.22}"

docker_cli() {
  # Git Bash otherwise rewrites container paths such as /dev/dri into Windows
  # host paths before the Docker CLI receives them. Linux ignores this variable.
  MSYS_NO_PATHCONV=1 docker "$@"
}

usage() {
  echo "Usage: $0 <vaapi|qsv|nvenc|vulkan> [render-device]" >&2
}

case "${backend}" in
  vaapi|qsv|vulkan)
    if [[ -n "${render_device}" && ! "${render_device}" =~ ^/dev/dri/renderD[0-9]+$ ]]; then
      echo "render-device must be a /dev/dri/renderD* node." >&2
      exit 64
    fi

    echo "Preflighting ${backend} access through the Docker daemon with ${probe_image}."
    if ! docker_cli run --rm \
      --device /dev/dri:/dev/dri \
      --env "RENDER_DEVICE=${render_device}" \
      "${probe_image}" sh -euc '
        if [ -n "${RENDER_DEVICE}" ]; then
          test -c "${RENDER_DEVICE}"
          printf "Selected DRM render node: %s\n" "${RENDER_DEVICE}"
        else
          set -- /dev/dri/renderD*
          test -c "$1"
          printf "DRM render nodes visible to daemon-started containers:\n"
          for device in "$@"; do test -c "${device}" && printf "- %s\n" "${device}"; done
        fi
      '; then
      cat >&2 <<'EOF'
Docker daemon GPU preflight failed: no usable DRM render node reached the
probe container. On ARC with Docker-in-Docker, mount the node's /dev/dri into
the dind container. Mounting it only into the runner container is insufficient
because --device paths are resolved by the Docker daemon.
EOF
      exit 1
    fi
    ;;
  nvenc)
    echo "Preflighting NVIDIA access through the Docker daemon with ${probe_image}."
    if ! docker_cli run --rm --gpus all "${probe_image}" sh -euc '
      test -c /dev/nvidiactl
      set -- /dev/nvidia[0-9]*
      test -c "$1"
      printf "NVIDIA control and GPU devices are visible to the probe container:\n"
      printf "- /dev/nvidiactl\n"
      for device in "$@"; do test -c "${device}" && printf "- %s\n" "${device}"; done
    '; then
      cat >&2 <<'EOF'
Docker daemon GPU preflight failed: `docker run --gpus all` did not expose an
NVIDIA GPU. The ARC dind container must receive a GPU, include NVIDIA Container
Toolkit support, and configure its nested Docker daemon with the NVIDIA runtime.
EOF
      exit 1
    fi
    ;;
  *)
    usage
    exit 64
    ;;
esac

printf 'Docker daemon hardware preflight passed for %s.\n' "${backend}"
