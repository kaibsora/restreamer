# Restreamer, modernized

> [!WARNING]
> **This fork is an experimental work in progress and is not production-ready.**
> It has not yet been validated across the intended physical GPU, USB-camera,
> IP-camera, printer, and network combinations. Automated builds and synthetic
> smoke tests are useful evidence, but they are not a substitute for real deployment
> testing. Expect incomplete documentation, breaking changes, and bugs with an
> unjustified amount of confidence.

## About this fork

This is a personal continuation of Restreamer driven by a practical need to monitor
multiple 3D printers with low-latency local streams and a separately buffered public
view. The maintainer is a systems engineer with this use case, not a professional
programmer. Refactoring, dependency upgrades, documentation, tests, and build
automation have been developed with substantial assistance from AI coding tools.
Those changes are reviewed and tested where possible, but AI assistance is not a
quality guarantee and should not be mistaken for expert authorship or exhaustive
validation.

This repository is independent community work. It is not an official datarhei
release, and the original maintainers are not responsible for changes made here.

## Origin and attribution

Restreamer was created by [datarhei](https://datarhei.com) and its contributors.
This fork would not exist without their architecture, implementation, documentation,
and years of open-source work. The unified repository incorporates and derives from
the following original repositories:

- [datarhei/restreamer](https://github.com/datarhei/restreamer) — application,
  packaging, and original project integration;
- [datarhei/core](https://github.com/datarhei/core) — FFmpeg process management and
  media-server backend;
- [datarhei/restreamer-ui](https://github.com/datarhei/restreamer-ui) — Restreamer
  web interface;
- [datarhei/ffmpeg](https://github.com/datarhei/ffmpeg) — FFmpeg build system,
  patches, and base-image work.

Credit and copyright remain with datarhei and the respective original contributors.
Their source is used under the applicable open-source licenses preserved in this
repository. Please direct issues caused by this fork here rather than to the upstream
projects; surprising the original maintainers with somebody else's AI-assisted
renovation would be poor form.

## Project direction

This fork turns the former multi-repository Restreamer build into one maintainable
source tree and one Linux AMD64 container image. Core, UI, the patched FFmpeg build,
deployment examples, and release automation now live together instead of requiring
four repositories to agree on what year it is.

The image is designed for multi-camera 3D-printer monitoring and contains one FFmpeg
build with:

- NVIDIA CUDA, NVDEC, and NVENC for H.264, HEVC, and AV1;
- Intel VA-API and Quick Sync through oneVPL, with H.264, HEVC, VP9, and AV1
  encoders exposed when supported by the GPU;
- AMD VA-API and Vulkan Video through Mesa, including AV1 on capable hardware;
- V4L2 devices, RTSP, RTMP, SRT, HLS, and WebRTC delivery through MediaMTX;
- Restreamer's JSON progress and HLS sequence patches.

The container can fall back to software processing when no GPU is exposed. Compiled
support does not invent a working host driver, although GPU packaging has spent years
trying to make that distinction feel unnecessarily mysterious.

## Current technical status

The unified image builds and boots successfully with FFmpeg 9.0.2. Its build gate
verifies the expected hardware APIs, encoders, filters, license, and Restreamer
patches before an image can be published. Physical-device throughput and
glass-to-glass latency have not been validated across the target Linux hosts and
cameras. Treat all published images as pre-release test artifacts until that hardware
acceptance work is complete.

The release workflow publishes the current image as:

```text
ghcr.io/kaibsora/restreamer:latest
```

Versioned images are also available as `ffmpeg-VERSION`; for example,
`ghcr.io/kaibsora/restreamer:ffmpeg-9.0.2`. Both tags are anonymously pullable from
GitHub Container Registry. Local builds remain useful when changing the source or
testing a release before publication.

## Quick start

Requirements:

- Linux AMD64 host;
- Docker Engine with Compose v2;
- a compatible host GPU driver for hardware acceleration;
- NVIDIA Container Toolkit only when using an NVIDIA GPU.

Clone the repository and start Restreamer plus the LAN MediaMTX relay:

```sh
git clone https://github.com/kaibsora/restreamer.git
cd restreamer
docker compose -f deploy/compose.yaml up -d
```

Open `http://HOST:8080/ui/`. Persistent configuration and data are stored in named
Docker volumes.

For public access, terminate TLS at a dedicated reverse-proxy hostname and forward
the complete site—not a `/restreamer/` subpath—to port 8080. The NGINX, Caddy, and IIS
examples in [the reverse-proxy guide](docs/reverse-proxy.md) preserve the host and
browser origin correctly, redirect HTTP to HTTPS, and cover large media uploads.

For Intel or AMD hardware acceleration:

```sh
RENDER_GID="$(getent group render | cut -d: -f3)" \
VIDEO_GID="$(getent group video | cut -d: -f3)" \
docker compose -f deploy/compose.yaml -f deploy/compose.dri.yaml up -d
```

For NVIDIA hardware acceleration:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.nvidia.yaml up -d
```

For USB cameras, copy `deploy/compose.camera-example.yaml`, list only the devices the
container needs, and add the copied file as another Compose override. Do not use
`--privileged` merely because a webcam exists; device permissions are not a séance.

Verify what the running container can actually see:

```sh
docker exec restreamer restreamer-hardware-report
```

On the target GPU host, require every detected runtime to encode a real H.264 test
frame instead of merely trusting FFmpeg's compiled encoder list:

```sh
docker exec restreamer restreamer-hardware-report --verify
```

The command probes NVENC when the NVIDIA runtime is present, VA-API for an exposed
DRM render node, Quick Sync on Intel VA-API drivers, and Vulkan Video on a discrete
or integrated Vulkan GPU. It exits nonzero when a detected backend cannot encode or
when no hardware runtime is available. Require the backend intended for a particular
host so another working GPU cannot hide a missing runtime:

```sh
# Intel
docker exec restreamer restreamer-hardware-report \
  --verify --require vaapi --require qsv

# NVIDIA
docker exec restreamer restreamer-hardware-report --verify --require nvenc

# AMD (choose the backend configured for the channel)
docker exec restreamer restreamer-hardware-report --verify --require vaapi
docker exec restreamer restreamer-hardware-report --verify --require vulkan
```

For multi-GPU Vulkan hosts, select the FFmpeg device index with
`RESTREAMER_VULKAN_DEVICE` on the container.
VA-API and Quick Sync encoder forms expose their DRM render node directly; select
`/dev/dri/renderD129` (or the appropriate mapped node) when the intended Intel/AMD
GPU is not `renderD128`.
For automated acceptance on a multi-GPU host, set `RESTREAMER_VAAPI_DEVICE` and/or
`RESTREAMER_QSV_DEVICE` on the container to the same mapped render nodes. The
hardware report enumerates all usable nodes but verifies the configured devices,
preventing an unrelated GPU from donating a misleading green check.

Then probe the real USB and IP-camera sources concurrently from inside the running
container:

```sh
ACCEPT_REPORT_FILE=restreamer-acceptance.json \
ACCEPT_HARDWARE_BACKENDS=vaapi,qsv \
  scripts/accept-deployment.sh \
  v4l2:/dev/video0 \
  rtsp://printer-one.lan:8554/stream.h264 \
  rtsp://camera-two.lan/stream
```

The acceptance command requires each source to produce its first decoded frame in
under one second, then keeps every source decoding concurrently for ten seconds. It
fails as a group if any source misses the startup limit, stalls, or falls below the
configured minimum decode rate. The optional JSON report records the container image,
per-camera timings, decoded-frame counts, and credential-redacted source URLs. Adjust
the sustained window and floor with `ACCEPT_SAMPLE_SECONDS` and
`ACCEPT_MIN_SAMPLE_FPS`. Override `ACCEPT_MAX_FIRST_FRAME_MS` only when documenting an
intentional deployment requirement, not when the camera is feeling contemplative.

Once Restreamer is publishing named outputs to MediaMTX, verify the paths used by the
printer dashboards as a separate gate:

```sh
ACCEPT_RELAY_REPORT_FILE=restreamer-relays.json \
  scripts/accept-relays.sh printer-one printer-two
```

This checks each WebRTC endpoint from the deployment host and concurrently applies
the same sub-second first-frame and sustained-decode checks to every RTSP publication
from inside the Restreamer container. A green input test with an empty output path is,
after all, just a very efficient surveillance system for nobody.

This gate measures connection startup and sustained decoding from the container's
network/device namespace. It does not measure photon-to-display delay. Final
glass-to-glass acceptance still requires a visible millisecond clock or equivalent
physical measurement at each printer dashboard.

See [deploy/README.md](deploy/README.md) for device mapping, WebRTC connectivity,
Crowsnest, Moonraker, and low-latency camera topology.

See [docs/api-process-control.md](docs/api-process-control.md) to list, start, stop,
restart, and inspect individual ingests or publications through the authenticated
REST API. This is the resource-control path for installations with many cameras.

See [docs/reverse-proxy.md](docs/reverse-proxy.md) for TLS termination and complete
NGINX, Caddy, and IIS routing examples.

### Large loop-file uploads

Audio and video loop sources no longer have an arbitrary browser-side 25 MiB limit.
The UI sends the selected `File` directly to Core, which streams it into disk storage
instead of first duplicating the entire file into an `ArrayBuffer`. Available disk
space and `CORE_STORAGE_DISK_MAX_SIZE_MBYTES` are therefore the application-side
limits. Image, logo, and poster uploads retain their smaller safety limits.

If a large upload fails only through a reverse proxy, increase that proxy's request
body and timeout limits or perform the upload through the LAN address. Restreamer
cannot overrule a proxy that rejects the request before it reaches the container;
HTTP remains stubbornly committed to causality. This behavior addresses
[upstream issue #958](https://github.com/datarhei/restreamer/issues/958).

## Camera and latency model

LAN monitoring and public viewing use separate delivery planes:

1. Restreamer ingests USB cameras, IP-camera RTSP URLs, or RTSP produced by
   Crowsnest's `camera-streamer` mode.
2. A LAN output is copied or encoded with a short GOP and published to MediaMTX.
3. Printer dashboards consume MediaMTX through WebRTC; native clients may use RTSP.
4. Public viewers use Restreamer's HLS player through the authenticated reverse
   proxy, where extra buffering is acceptable.

Prefer stream copy for an existing H.264 camera feed. Every unnecessary decode and
re-encode adds latency, GPU load, and another opportunity for software to demonstrate
creativity. When transcoding is required, use a hardware encoder, no B-frames, a
one-second-or-shorter GOP, and the low-latency input option exposed by the UI.

Sub-second latency is a target to validate on the real network, not a property that
can be certified by compiling an encoder inside Docker Desktop.

## Build locally

Build the hardware FFmpeg base first:

```sh
IMAGE_NAME=restreamer-ffmpeg:hardware components/ffmpeg/Build.sh
```

The helper and GitHub Actions share the same stable-release resolver. Pass a
specific release as the first argument only when reproducing an older build.

Then build the unified application:

```sh
docker buildx build --load \
  --build-arg FFMPEG_IMAGE=restreamer-ffmpeg:hardware \
  --tag restreamer:local .
```

Run the same FFmpeg contract used during releases:

```sh
docker run --rm --entrypoint /usr/local/bin/restreamer-verify-ffmpeg \
  restreamer:local
```

Run the complete Restreamer and MediaMTX camera-stack smoke test:

```sh
RESTREAMER_IMAGE=restreamer:local scripts/smoke-compose.sh
```

The gate publishes four independent H.264 camera feeds by default, probes every RTSP
path and WebRTC endpoint concurrently, and requires every first decoded RTSP frame to
arrive in under one second. The all-intra synthetic sources deliberately remove camera
GOP delay so the test measures container, relay, and client startup overhead. Override
the load or threshold with `SMOKE_CAMERA_COUNT` and `SMOKE_MAX_FIRST_FRAME_MS`.

This is a repeatable software-path latency gate, not a substitute for glass-to-glass
measurement with the final camera, encoder settings, network, and display. Apparently
photons remain unwilling to participate in GitHub Actions.

## Releases

`.github/workflows/build-unified.yml` supports manual, source-triggered, and daily
FFmpeg release checks. A scheduled run stops before the expensive image builds when
the resolved `hardware-VERSION` tag already exists; manual runs and relevant source
pushes still force a rebuild. It:

1. resolves the newest stable FFmpeg source release unless a version is supplied;
2. builds the redistributable hardware FFmpeg image;
3. fails if required hardware support or Restreamer patches disappear;
4. rejects high or critical production dependency vulnerabilities;
5. runs the Core tests and vet checks plus all UI tests;
6. validates the Compose and MediaMTX deployment configuration;
7. pins the unified build to the FFmpeg image digest;
8. boots and probes the application before publishing to GitHub Container Registry;
9. emits provenance and an SBOM for both images.

All jobs run on the Actions Runner Controller scale set named `restreamer-linux`.
ARC schedules by scale-set name and does not add the conventional `self-hosted`
label, because apparently even labels needed two incompatible dialects. If your ARC
scale set has another name, create the repository Actions variable
`RESTREAMER_RUNNER_LABELS` containing a JSON array with that name, for example:

```json
["my-restreamer-linux-scale-set"]
```

The variable also accepts a traditional self-hosted runner label set such as
`["linux", "x64"]` when the repository is not using ARC.

Each runner needs Git, Bash, curl, Docker Engine, Docker Compose v2, Docker Buildx,
and at least 40 GiB of free workspace disk. Its service account must be allowed to
access Docker. Set `RESTREAMER_MIN_RUNNER_DISK_GB` in the runner service environment
only when the builder has a deliberately different storage budget.

The runner preflight places `DOCKER_CONFIG` under GitHub's per-job `RUNNER_TEMP`.
This avoids ARC images whose `/home/runner/.docker` mount is intentionally read-only
and keeps registry credentials isolated to the ephemeral job instead of leaving them
behind in a shared home directory. The preflight links the runner image's read-only
`~/.docker/cli-plugins` directory into that isolated configuration so Docker Compose
and Buildx remain discoverable in later workflow steps.

Fork pull requests are not executed on these runners. A public repository handing
unreviewed fork code a Docker socket would be an unusually efficient way to donate
the server to strangers. Same-repository pull requests continue to run normally.

GitHub Container Registry packages are not guaranteed to become public merely
because their source repository is public. The `restreamer` and
`restreamer-ffmpeg` packages are connected to this repository and public. If either
package is recreated, restore that repository connection, grant Actions write
access, and set package visibility to public. Otherwise the lovingly automated
public image will require authentication, which is a rather avant-garde
interpretation of “anyone can use it.”

Pull requests run the quality gates without publishing images. The two inherited
bundle workflows were removed because they built external datarhei components with
obsolete FFmpeg images and attempted to publish to the upstream Docker Hub account.
One repository now has one release pipeline, a concept CI systems traditionally
survive without emotional distress.

The workflow resolves the published FFmpeg image to an immutable digest before it
builds Restreamer. Ordinary Core, UI, and deployment changes reuse that digest
instead of recompiling FFmpeg. FFmpeg is rebuilt when its source or build inputs
change, when a scheduled check discovers a new upstream release, or when a manual
workflow run requests a build. Scheduled checks become clean no-ops when the current
release is already published.

An upstream FFmpeg release that no longer accepts the Restreamer patches is expected
to fail loudly. Silently publishing an unpatched binary would be impressively tidy
automation of the wrong result.

## Repository layout

- `components/core`: Go backend and process manager
- `components/ui`: React administration and player UI
- `components/ffmpeg`: FFmpeg source build and Restreamer patches
- `deploy`: Compose, MediaMTX, camera, and GPU deployment assets
- `docs/architecture.md`: system architecture and release policy
- `docs/api-process-control.md`: authenticated ingest and publication controls
- `.github/workflows`: image build and publication automation

See [CONTRIBUTING.md](CONTRIBUTING.md) for development and upstream synchronization.

## License and provenance

The repository retains the original Apache-2.0 project license and component
history. FFmpeg is built without nonfree components and reports a redistributable
GPLv3-or-later configuration. See [LICENSE](LICENSE) and the component license files
for details.
