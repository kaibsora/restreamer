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

Published unified images build and boot with an immutable FFmpeg source revision;
scheduled and manual builds track FFmpeg's current development branch by commit. The
build gate verifies the expected hardware APIs, encoders, filters, license, and Restreamer
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

For reproducible testing, prefer the immutable `sha-*` tag shown by the successful
build workflow instead of `latest`. The running Core API reports the repository
commit, branch, and build date embedded in the image, so a bug report can identify
the executable rather than describing it as “whatever latest meant on Tuesday.”

The fork does not contact datarhei's update service or send instance telemetry.
Until the project defines and publishes its own versioned releases, watch the
repository or use immutable `sha-*` and `ffmpeg-git-*` GHCR tags to track updates.
The legacy `update_check` configuration key and `CORE_UPDATE_CHECK` environment
variable are accepted only for compatibility and have no effect.

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
configured minimum decode rate. The optional JSON report records the container tag,
immutable repository digests, OCI source labels, per-camera timings, decoded-frame
counts, and credential-redacted source URLs. Adjust
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

### Move or duplicate a channel

Open the channel drawer and select the channel to move. The download button exports
its ingest, snapshot worker, publications, and Restreamer metadata as a versioned
JSON bundle. On the destination instance, use the upload button in the same drawer
to import it. Every channel and process ID is remapped, so the bundle can also be
imported more than once on one instance to create independent copies. Processes are
created with autostart disabled and only restored to their saved state after the
whole bundle and its metadata have been accepted; a partial failure is rolled back.

Treat the exported file like a secret. Camera URLs, publication endpoints, tokens,
and passwords present in the process configuration remain in the bundle so the
imported channel can work. Uploaded poster and logo images are embedded using
binary-safe encoding and restored under the remapped channel ID. Video-loop and
audio-loop files are deliberately excluded because turning a multi-gigabyte media
file into browser-held JSON would be less “migration” and more “denial of service
with extra steps”; copy or upload those files separately. This provides
the selected-channel migration requested in
[upstream issue #955](https://github.com/datarhei/restreamer/issues/955) without
requiring a raw copy of the entire Core database—because “just transplant the
database” is less a migration plan than a hostage situation.

### Burn a logo or channel name into video

In **Edit → Video settings**, select a video encoder instead of stream copy and
enable **Burn logo or text into the encoded video** under the filter settings.
Upload a PNG or JPEG, choose its position, pixel width, opacity, and edge margin,
and optionally enter a channel name or other text with independent position, size,
color, and background controls. The text is stored as a UTF-8 channel asset rather
than interpolated into an FFmpeg command, so punctuation and non-Latin names do not
become accidental filter syntax.

Branding is applied to the ingest's encoded frames. HLS, RTMP, SRT, RTSP,
RTP/MPEG-TS, and MediaMTX publications derived from that ingest therefore receive
the same pixels; this is not the separate logo drawn by the public browser player.
The logo and text assets are persistent under `/core/data`, are included in channel
export/import bundles, and are remapped with the destination channel ID.

Hardware encoders remain available. The image/text composition happens before the
encoder-specific VA-API, QSV, NVENC, or Vulkan upload stage, so a single UI path
works across the unified image instead of maintaining four subtly incompatible
versions of “put this PNG in the corner.” Branding necessarily requires
transcoding; FFmpeg cannot alter pixels while also copying those same pixels
unchanged, despite the occasional feature request for precisely that act of magic.

This implements the encoded branding requested in
[upstream issue #946](https://github.com/datarhei/restreamer/issues/946) and
[upstream issue #982](https://github.com/datarhei/restreamer/issues/982).

### Keep USB capture audio synchronized

Encoded audio enables **Correct live audio clock drift** in the resample filter by
default. FFmpeg then stretches, trims, or pads a bounded number of samples so audio
follows its capture timestamps. This prevents the independent oscillators in a USB
video device and ALSA audio device from gradually turning a synchronized stream into
an accidental dubbed film. Disable the option only when a source supplies unsuitable
timestamps; stream-copy audio cannot be filtered and therefore cannot be corrected.

The image build executes a deliberately skewed audio clock and verifies that the
resampler changes the output sample duration to follow it. Physical acceptance still
requires a long-running USB capture on the target host because synthetic timestamps
cannot certify a particular capture card, kernel driver, or oscillator. This addresses
the software-side drift reported in
[upstream issue #936](https://github.com/datarhei/restreamer/issues/936).

### Recover a frozen RTMP publisher clock

The embedded RTMP server keeps an established publisher connected when its media
timestamps stop advancing. After eleven repeated timestamps it derives timestamps
from the connection wall clock, matching the recovery already used for broken
startup clocks. This prevents a transient camera or encoder clock fault from killing
the pull URL while other outputs mysteriously continue working. A loopback publisher
regression starts with valid AAC timestamps, freezes them after packet 25, and proves
that later packets remain readable. This addresses the failure reported in
[upstream issue #952](https://github.com/datarhei/restreamer/issues/952).

### Keep LAN viewers connected while a camera is offline

Add a **MediaMTX resilient LAN relay** publication when a printer dashboard should
remain connected during camera or ingest outages. The preset publishes video-only
H.264 to one of 16 explicit `resilient/01` through `resilient/16` slots. MediaMTX
supplies an offline slate before the publisher arrives, swaps to live video without
disconnecting existing readers, and restores the slate when the publisher stops.
The camera-stack smoke test holds one reader open through that complete
offline/live/offline sequence and requires it to decode both sources.

The separate resilient preset deliberately removes audio because MediaMTX requires
the live publisher and fallback stream to expose the same tracks. Ordinary LAN relay
publications continue to support AAC or Opus. See the
[deployment guide](deploy/README.md#keep-a-dashboard-stream-available-while-its-camera-is-offline)
for paths and limitations. This addresses the fallback behavior requested in
[upstream issue #965](https://github.com/datarhei/restreamer/issues/965).

Frigate users can point its bundled go2rtc relay at the same MediaMTX RTSP path,
allowing one Restreamer H.265-to-H.264 transcode to feed detection, recording, and
live view. The [Frigate integration guide](docs/frigate.md) includes current Frigate
YAML, direct-input alternatives, validation commands, and the video-only limitation
of resilient paths. This documents the deployment requested in
[upstream issue #906](https://github.com/datarhei/restreamer/issues/906).

### Disable the public landing page

Open **Publication website → General**, clear **Publish public landing page**, and
save. Restreamer removes the root landing page, every generated per-channel landing
page, and its generated script. Direct HLS, RTMP, SRT, RTSP, RTP/MPEG-TS, and
MediaMTX publications keep running; disabling a website should not also unplug the
camera, despite both involving the word “stream.” Custom templates remain stored so
they are available if the landing page is enabled again.

This completes the publication control requested in
[upstream issue #892](https://github.com/datarhei/restreamer/issues/892).

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

### Native HEVC HLS playback

Select HLS version 7 when an ingest copies or encodes HEVC/H.265 for browser
playback. Restreamer writes fragmented MP4 and marks the video sample entry as
`hvc1`, matching
[Apple's HEVC HLS authoring guidance](https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices/).
The build and camera-stack gates inspect the generated init segment and also decode
the simultaneous MPEG-TS tee output, because fixing one output by quietly breaking
another would be an impressively unhelpful interpretation of compatibility.

The browser and operating system must still provide an HEVC decoder. Codec support
varies by browser, OS, hardware, and installed media components; use H.264 when broad
client compatibility matters more than preserving an HEVC source. HLS versions 3
and 6 remain MPEG-TS outputs and do not receive an MP4 codec tag. This addresses the
container-tag failure reported in
[upstream issue #985](https://github.com/datarhei/restreamer/issues/985).

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

The helper and GitHub Actions resolve FFmpeg's current `master` commit by default,
then build that immutable SHA. Pass `stable` for the newest numbered release, an
exact release such as `9.0.2`, or `git-` followed by a full 40-character commit SHA
when reproducing a build.

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
docker run --rm --entrypoint /usr/local/bin/restreamer-verify-hevc-hls \
  restreamer:local
```

Run the complete Restreamer and MediaMTX camera-stack smoke test:

```sh
RESTREAMER_IMAGE=restreamer:local scripts/smoke-compose.sh
```

The gate publishes four independent H.264 camera feeds by default, sends another feed
through Core's SRT server and a managed FFmpeg relay, probes every resulting RTSP and
WebRTC endpoint concurrently, and requires every first decoded RTSP frame to arrive in
under one second. The all-intra synthetic sources deliberately remove camera GOP delay
so the test measures container, transport, relay, and client startup overhead. Override
the direct-camera load or threshold with `SMOKE_CAMERA_COUNT` and
`SMOKE_MAX_FIRST_FRAME_MS`.

The same smoke gate opens 128 concurrent HLS viewer sessions, downloads a media
segment for each, and requires Core to report all 128 as active. Run the reusable
probe against an existing public HLS publication with:

```sh
scripts/accept-hls-viewers.sh https://restream.example.com/memfs/CHANNEL.m3u8 128
```

This covers the application-side session failure reported in
[upstream issue #951](https://github.com/datarhei/restreamer/issues/951). It does not
promise that a host or internet connection has `128 × stream bitrate` of egress
capacity; use a media-aware CDN when origin bandwidth is the bottleneck.

This is a repeatable software-path latency gate, not a substitute for glass-to-glass
measurement with the final camera, encoder settings, network, and display. Apparently
photons remain unwilling to participate in GitHub Actions.

## Releases

`.github/workflows/build-unified.yml` supports manual, source-triggered, and daily
FFmpeg source checks. A scheduled run stops before the expensive image builds when
the resolved `ffmpeg-hardware-git-SHA` tag already exists; manual runs and relevant
source pushes still force a rebuild. It:

1. resolves FFmpeg's current development commit unless another source is supplied;
2. builds the redistributable hardware FFmpeg image;
3. fails if required hardware support or Restreamer patches disappear;
4. rejects high or critical UI production advisories and unreviewed reachable Go
   vulnerabilities;
5. runs the Core tests and vet checks plus all UI tests;
6. validates the Compose and MediaMTX deployment configuration;
7. pins the unified build to the FFmpeg image digest;
8. boots and probes the application before publishing to GitHub Container Registry;
9. pulls the published digest back from GHCR and verifies its commit identity and
   FFmpeg contract;
10. emits provenance and an SBOM for both images.

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

`.github/workflows/accept-hardware.yml` is the manual runtime gate for a GPU-backed
ARC runner. Select `vaapi`, `qsv`, `nvenc`, or `vulkan`; the job pulls the requested
unified image, records its immutable repository digest, maps `/dev/dri` or requests
the NVIDIA container runtime as appropriate, and requires that backend to encode a
real frame. Its 30-day artifact contains the image identity and complete hardware
report, turning “the encoder is listed” into evidence that a driver accepted work.

The hardware workflow uses `RESTREAMER_HARDWARE_RUNNER_LABELS` when defined, then
falls back to `RESTREAMER_RUNNER_LABELS` and finally `restreamer-linux`. Point the
hardware-specific variable at a GPU-enabled ARC scale set if the ordinary builders
do not expose GPUs. Store the labels as a JSON array, just like the build workflow;
for example `["restreamer-linux", "linux", "x64"]`. Do not add `self-hosted` to an
ARC label set.

Scheduling the runner pod on a GPU node is necessary, but it does not give the
nested Docker daemon a GPU by osmosis. The hardware workflow first uses a tiny
Alpine container to verify access from the daemon's namespace, before downloading
the much larger Restreamer image. A failed preflight is retained as
`hardware-runner.txt` and identifies the missing layer.

For VA-API, Quick Sync, and DRM-backed Vulkan on ARC DinD runners:

1. select a GPU node for the runner pod and apply any required toleration;
2. define a `/dev/dri` `hostPath` volume with type `Directory`;
3. mount that volume at `/dev/dri` in the **dind** container; and
4. keep the dind container privileged so its Docker daemon can map render nodes.

Mounting `/dev/dri` only in the `runner` container cannot work: the Docker CLI is
the client, while the daemon in `dind` resolves `--device`. GitHub's generated DinD
PodSpec must be copied into the scale-set values and customized after removing
`containerMode`, as described in the
[official ARC container-mode documentation](https://docs.github.com/en/actions/how-tos/manage-runners/use-actions-runner-controller/deploy-runner-scale-sets#customizing-container-modes).

For NVIDIA runners, the dind container must request a GPU, contain the NVIDIA
Container Toolkit, and configure its nested Docker daemon to recognize the NVIDIA
runtime. NVIDIA documents the required `nvidia-ctk runtime configure
--runtime=docker` setup in the
[Container Toolkit installation guide](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html#configuring-docker).
The ordinary build scale set does not need any of this hardware access; use a
dedicated scale set through `RESTREAMER_HARDWARE_RUNNER_LABELS` when practical.

GitHub Container Registry packages are not guaranteed to become public merely
because their source repository is public. The workflow stores both the final image
and its immutable `ffmpeg-hardware-*` build-stage tags in the single `restreamer`
package connected to this repository. If that package is recreated, restore the
repository connection, grant Actions write access, and set package visibility to
public. Otherwise the lovingly automated public image will require authentication,
which is a rather avant-garde interpretation of “anyone can use it.”

Pull requests run the quality gates without publishing images. The two inherited
bundle workflows were removed because they built external datarhei components with
obsolete FFmpeg images and attempted to publish to the upstream Docker Hub account.
One repository now has one release pipeline, a concept CI systems traditionally
survive without emotional distress.

The workflow resolves the published FFmpeg stage to an immutable digest before it
builds Restreamer. Ordinary Core, UI, and deployment changes reuse that digest
instead of recompiling FFmpeg. FFmpeg is rebuilt when its source or build inputs
change, when a scheduled check discovers a new upstream commit, or when a manual
workflow run requests a build. Scheduled checks become clean no-ops when the current
commit is already published. Keeping the stage in the final image's package avoids
a second GHCR permission boundary without weakening digest pinning.

An upstream FFmpeg commit that no longer accepts the Restreamer patches is expected
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
The [upstream issue ledger](docs/upstream-issues.md) records inherited reports that
this fork has fixed, covered, or intentionally left pending real-hardware evidence.

## License and provenance

The repository retains the original Apache-2.0 project license and component
history. FFmpeg is built without nonfree components and reports a redistributable
GPLv3-or-later configuration. See [LICENSE](LICENSE) and the component license files
for details.
