# Raspberry Pi and native multi-platform builds

The multi-platform candidate pipeline targets `linux/amd64` and `linux/arm64`.
Docker selects the matching architecture from the combined image tag; no
`platform:` setting or architecture-specific application tag is necessary.
Until that candidate passes both native jobs and release promotion, the existing
`latest` and immutable `rc-1` remain the previously accepted AMD64 release.

## Deploy on a 64-bit Raspberry Pi

Use a 64-bit Linux OS, Docker Engine and Docker Compose 2.30 or newer. The image
does not support 32-bit `armv7`/`armv6` systems. Clone the `main` branch after
the multi-platform release is published, then run:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.raspberrypi.yaml pull
docker compose -f deploy/compose.yaml -f deploy/compose.raspberrypi.yaml up -d
```

Open `http://PI_ADDRESS:8080/ui/`. This override removes the desktop `/dev/dri`
mapping and exposes V4L2 camera/codec devices through Core's integrated hot-plug
watcher. It needs no external hot-plug daemon and grants no `privileged` access.
Set `VIDEO_GID` to the host video group's numeric ID if it differs from 44.
Keep both Compose files and the same project name when updating.

## Acceleration and limits

* The ARM image contains upstream FFmpeg with Linux V4L2 M2M and DRM support,
  plus software encoders/decoders. It omits CUDA, NVENC, Quick Sync, VA-API and
  Vulkan driver stacks. The AMD64 image retains the desktop GPU stacks.
* Pi 4 and supported earlier models can use **H.264 (V4L2 M2M)** when their
  host kernel exposes the stateful codec device (often `/dev/video11`). Codec
  nodes are available to FFmpeg but hidden from the camera-source dropdown.
  Compiled encoder availability does not prove that a particular kernel/device
  works. Physical Pi codec acceleration has not yet been validated here.
* Pi 5 has no H.264 hardware encoder. Use **H.264 (libx264)** with settings the
  CPU can sustain, or copy a camera's native H.264 stream where available.
  Upstream FFmpeg does not provide the Pi's stateless V4L2 Request HEVC decoder
  in this build; DRM presence alone does not enable it.
  `restreamer-hardware-report` lists compiled APIs/devices; its `--verify` mode
  currently validates desktop GPU backends, not Pi V4L2 M2M. It is expected to
  report no usable hardware encoder on a Pi 5 using this build.
* USB/IP cameras are supported through the existing source setup. CSI cameras
  requiring libcamera/rpicam are not integrated into this container. Publish a
  compatible network stream from the host and add it as a network source.
* HLS retains buffering and camera keyframe constraints. RTSP/RTMP relay delivery
  uses the same configuration as AMD64; do not assume a Pi can encode the same
  number or resolution of streams as a desktop.

Hardware references: [Raspberry Pi camera documentation](https://www.raspberrypi.com/documentation/accessories/camera-software.html)
and [official Pi 5 H.264 performance paper](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-010033-WP-1-H.264%20encoding%20performance%20on%20Raspberry%20Pi%205_series%20computers.pdf).

## Build and release

`restreamer-linux` runs native AMD64 jobs and `restreamer-arm64` runs native
ARM64 jobs using its advertised `[linux, arm64, docker]` routing labels.
ARC selectors contain no `self-hosted` label. Optional repository
variables `RESTREAMER_RUNNER_LABELS` and `RESTREAMER_ARM64_RUNNER_LABELS` override
these selectors with JSON arrays. A preflight rejects runner/Docker architecture
mismatches; QEMU is not used.
Each ARC namespace must already have its configured GitHub authentication secret.
The image workflows do not create or distribute runner credentials.

Both builds use one resolved FFmpeg source revision. Architecture-specific
runtime/source tags and caches prevent cross-platform collisions. The 4 GB Pi
runner builds FFmpeg and Go with one worker and BuildKit serializes stages.
Native acceptance covers software video, source/license retention and the
camera/relay stack; it is not a physical Pi camera or codec test.

Successful platform images, including their provenance/SBOM manifests, become
one `build-<run>-<attempt>` candidate index. Promotion on `main` requires both
architectures and native verification before updating `latest` and a new fixed
`rc-N` tag. `rc-1` is never overwritten. `development` builds publish candidates
only. See [Docker's native matrix guidance](https://docs.docker.com/build/ci/github-actions/multi-platform/).

## Generated footer name

The footer keeps the original `adjective-noun-0000` style. Its seed is Core's
application Git commit, so the same commit produces the same name on both
architectures and after restarts. New application commits generate a new name.
It is a readable build label, not a unique/security identifier. The configured
Core instance name remains available through the API.
