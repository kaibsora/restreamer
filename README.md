# CQComber Restreamer

Self-hosted camera and livestream management in a Docker image. Ingest USB or IP
cameras, copy or transcode their video, and share streams through a web player,
printer dashboard or publishing service.

The image bundles a React web UI, the Core media/process backend and FFmpeg.
The included Compose setup also runs MediaMTX for LAN RTSP and WebRTC delivery.
This is an independent adaptation of [datarhei Restreamer](https://github.com/datarhei/restreamer).

**Image:** `ghcr.io/kaibsora/restreamer` · **Platforms:** `linux/amd64`, `linux/arm64`

[Changelog](CHANGELOG.md) · [Deployment details](deploy/README.md) · [Report an issue](https://github.com/kaibsora/restreamer/issues)

## Features

- Multiple USB/V4L2, network and virtual video sources.
- CPU encoding, desktop GPU encoding, or compatible camera H.264 stream copy.
- Integrated USB hot-plug, driver-provided camera controls and encoded rotation.
- HLS web playback and public pages; RTMP/SRT services; optional RTSP/WebRTC relay.
- Persistent configuration, reverse-proxy support, native multi-platform builds,
  image provenance/SBOMs and matching FFmpeg source packages.

## Supported systems

Use a Linux host, Docker Engine and **Docker Compose 2.30+**. Docker selects the
image architecture automatically. Host drivers and device permissions are still
required; a container cannot add hardware capabilities that the machine lacks.

| Platform / encoder | Support and validation |
| --- | --- |
| AMD64 CPU | Software encoding supported and tested |
| Intel VA-API / Quick Sync | Physically tested with Intel UHD 630; available codecs depend on GPU generation |
| AMD VA-API / Vulkan Video | Compiled support; **physical GPU validation outstanding** |
| NVIDIA NVENC | Requires host driver and NVIDIA Container Toolkit; **physical GPU validation outstanding** |
| ARM64 / Raspberry Pi 5 | CPU encoding and USB cameras physically tested |
| Raspberry Pi 4 V4L2 M2M | Compiled support; requires a compatible host kernel/codec device; **physical encoder validation outstanding** |

The ARM image contains software codecs and Linux V4L2/DRM support; it omits the
AMD64 CUDA, Intel and Vulkan driver stacks. There is no 32-bit ARM image or
integrated CSI/libcamera camera support. Docker Desktop USB/GPU passthrough is
outside the validated deployment target.

## Quick start

```sh
git clone --branch main https://github.com/kaibsora/restreamer.git
cd restreamer
```

Choose a deployment mode below, then open **`http://HOST:8080/ui/`**. Configure
authentication during initial setup before granting access to untrusted clients.
There is no shared default administrator password. Keep public viewing and
administration access boundaries appropriate to your deployment.
Fresh Core configuration has API authentication disabled; enable it in Settings
before exposing the service beyond trusted hosts.

### Intel / AMD host with `/dev/dri`

```sh
export RENDER_GID="$(stat -c %g /dev/dri/renderD128)"
export VIDEO_GID="$(getent group video | cut -d: -f3)"
docker compose -f deploy/compose.yaml up -d
```

Use the actual render node on multi-GPU hosts. In the UI choose VA-API or Quick
Sync and set that stream's hardware-device field to the correct device.

### CPU-only host without `/dev/dri`

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.cpu.yaml up -d
```

Choose **H.264 (libx264)** or another supported software encoder.

### 64-bit Raspberry Pi

```sh
export VIDEO_GID="$(getent group video | cut -d: -f3)"
docker compose -f deploy/compose.yaml -f deploy/compose.raspberrypi.yaml up -d
```

**Pi 5 has no H.264 hardware encoder.** Select **H.264 (libx264)**: Core launches
FFmpeg, whose `libavcodec` interface calls `libx264` to encode on the ARM CPU.
Raspberry Pi's [H.264 encoding performance paper](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-010033-WP-1-H.264%20encoding%20performance%20on%20Raspberry%20Pi%205_series%20computers.pdf)
compares this encoder with Pi 4 hardware encoding. Its benchmark settings are not
a guarantee for every camera, filter or number of concurrent streams. Compatible
camera-native H.264 can use stream copy to avoid re-encoding.

The Pi override includes USB hot-plug access. See the [Pi guide](docs/raspberry-pi.md)
for Pi 4 codec devices, cooling/load considerations and camera limitations.

### NVIDIA

Install the host driver and [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html), then run:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.cpu.yaml -f deploy/compose.nvidia.yaml up -d
```

Choose an NVENC encoder in the UI. On mixed NVIDIA + Intel/AMD hosts, omit the
CPU override to retain `/dev/dri` access.

### USB cameras and hot-plug

Append `-f deploy/compose.hotplug.yaml` to the selected non-Pi command:

```sh
export VIDEO_GID="$(getent group video | cut -d: -f3)"
docker compose -f deploy/compose.yaml -f deploy/compose.hotplug.yaml up -d
```

Put this override after the CPU override when combining them. The Pi override
already includes hot-plug. These Compose modes use Core's built-in watcher and
V4L2 device rules, without a privileged container, Docker socket or host daemon.
Do not combine hot-plug mode with explicit camera device bind mounts. For fixed
devices, adapt [compose.camera-example.yaml](deploy/compose.camera-example.yaml).

Select **Hardware device**, then the camera's capture format, resolution and frame
rate. **Detected video track** shows the selected mode's verified track, usually
one—not every resolution the camera supports. Camera controls depend on the
driver; rotation requires transcoding. See [USB details](docs/usb-hotplug.md).

### Minimal standalone container

For a new CPU-only installation without the Compose relay:

```sh
docker run -d --name restreamer --restart unless-stopped \
  -p 8080:8080 \
  -v restreamer-config:/core/config \
  -v restreamer-data:/core/data \
  ghcr.io/kaibsora/restreamer:latest
```

This publishes the UI/API/HLS port only. Use Compose for the documented GPU,
camera and relay configurations. Compose users should keep their existing
project and volume names rather than switch deployment methods during an upgrade.

## Local clients, printer dashboards and public viewers

The built-in player uses **HLS**, which buffers. Use RTSP/RTMP or the MediaMTX
WebRTC relay for latency-sensitive local clients. Stream copy avoids encoding
work, but a camera with long keyframe intervals can still have slow startup.

For **Mainsail / Fluidd**, enable Core's RTMP server in Settings and the channel's
RTMP output, then add a
**MediaMTX LAN relay** publication using that live RTMP source, and publish to
`rtsp://mediamtx:8554/STREAM_PATH`. In the dashboard select **WebRTC (MediaMTX)**
and enter `http://HOST:8889/STREAM_PATH`, without `/whep`. Native RTSP clients use
`rtsp://HOST:8554/STREAM_PATH`. Mainsail/Fluidd do not directly play arbitrary
RTMP/SRT streams; Crowsnest is not a general RTSP input adapter.

Set `RESTREAMER_WEBRTC_HOSTS` to reachable LAN addresses if ICE discovers an
unreachable container address. HTTPS dashboards require HTTPS signaling.
[LAN relay configuration](deploy/README.md#lan-rtsp-and-webrtc) covers ports,
reconnection and resilient streams.

For external HLS viewing, use a dedicated HTTPS reverse-proxy hostname and set
the correct published addresses in the UI. See [reverse-proxy examples](docs/reverse-proxy.md).
The supplied MediaMTX relay is for a trusted LAN; add authentication/network
controls before exposing it beyond that network.

## Ports and storage

| Port | Purpose |
| --- | --- |
| `8080/tcp` | Web UI, API, HLS and public pages |
| `8181/tcp` | Core HTTPS, when enabled |
| `1935/tcp`, `1936/tcp` | Core RTMP / RTMPS, when enabled |
| `6000/udp` | Core SRT, when enabled |
| `8554/tcp` | MediaMTX RTSP |
| `8000/udp`, `8001/udp` | MediaMTX RTP / RTCP, if used |
| `8889/tcp`, `8189/udp` | MediaMTX WebRTC signaling / media |

Publishing a port does not enable its Core service. The Compose files start
Restreamer and MediaMTX; use `up -d restreamer` for the application alone.
Named volumes retain `/core/config` and `/core/data`. Keep the same Compose
project name and the same override files for subsequent commands.

## Versions, updates and rollback

See [published releases](https://github.com/kaibsora/restreamer/releases) for
available versions. Stable promotion creates the following tag scheme:

| Tag | Purpose |
| --- | --- |
| `1.0.0` | Immutable versioned application release |
| `1.0`, `1` | Most recently accepted stable release in that minor / major line |
| `latest` | Most recently accepted stable release |
| `build-<run>-<attempt>` | Development or release-validation candidate |
| `@sha256:<digest>` | Exact immutable image identity |

The checked-in Compose file follows `latest`. For reproducible deployments, pin
its `image:` to a version or digest. Back up the volumes and export the UI
configuration before upgrading; exports may contain camera passwords or keys.

Using the **same files and project options as your original deployment**:

```sh
docker compose -f deploy/compose.yaml pull
docker compose -f deploy/compose.yaml up -d
```

Include your GPU/camera/Pi overrides in both commands. Hard-refresh the browser
after updating. To roll back, restore the previous image reference and recreate
the containers; restore a matching configuration backup if a newer release has
migrated settings. **`docker compose down -v` deletes saved volumes.**

`main` holds release code; new work and testing happen on `development`. Native
ARC jobs build AMD64/ARM64 candidates, run acceptance checks and combine their
manifests. Scheduled/manual builds resolve upstream FFmpeg to an immutable
revision. They do not move `latest`; stable promotion retags a validated digest
without rebuilding.

## Component baseline

| Component | Version / source |
| --- | --- |
| CQComber Restreamer | 1.0 release line |
| Core | Fork of datarhei Core **16.16.0** |
| Administration UI | Fork of Restreamer UI **1.14.0** |
| FFmpeg / FFprobe | **8.0.git** upstream development snapshot, source [`02970f067cf06c5c23209d521575b1024898bb29`](https://github.com/FFmpeg/FFmpeg/commit/02970f067cf06c5c23209d521575b1024898bb29) |
| MediaMTX | **1.21.3**, optional companion container |
| Runtime base | **Ubuntu 24.04**, with architecture-specific libraries |

FFmpeg's historical development banner does not identify a stable release or
limit its library APIs. This snapshot includes libavcodec **63.28.100**,
libavformat **63.18.100** and libavutil **61.20.100**.
The source SHA and each release's image/source record
identify the actual build. [Release records](https://github.com/kaibsora/restreamer/releases)
include immutable image identities; [THIRD_PARTY.md](THIRD_PARTY.md) lists codecs,
drivers, UI dependencies and corresponding-source download instructions.

## Known limits and troubleshooting

- AMD/NVIDIA GPU support and Pi 4 hardware encoding remain physically untested.
- Physical acceptance covered video; audio has not received equivalent testing.
- HLS startup depends on buffering and source keyframes; no universal sub-second
  camera-to-display guarantee is made. See [latency validation](docs/low-latency-validation.md).
- Camera controls may reset after reconnect/reboot and are not automatically
  reapplied. Camera modes and USB bandwidth vary by device and host controller.
- CSI/libcamera and media-controller ISP pipelines are not integrated camera
  inputs; publish a compatible network stream from host camera software instead.

For desktop GPU diagnostics, run `docker exec restreamer restreamer-hardware-report --verify`.
On Pi 5, use the report without `--verify`: no H.264 hardware encoder is expected.
Report defects with an exact image tag/digest and sanitized logs in
[this repository](https://github.com/kaibsora/restreamer/issues).

## Credits and licenses

- **datarhei / FOSS GmbH and contributors** — original [Restreamer](https://github.com/datarhei/restreamer),
  [UI](https://github.com/datarhei/restreamer-ui), [Core](https://github.com/datarhei/core)
  and [FFmpeg build integration](https://github.com/datarhei/ffmpeg).
- **[FFmpeg developers](https://ffmpeg.org/)** and codec/library authors — the
  multimedia engine, including x264 and the other bundled upstream libraries.
- **[MediaMTX contributors](https://github.com/bluenviron/mediamtx)** — the LAN relay.
- **CQComber / [kaibsora](https://github.com/kaibsora)** — maintainer, project
  direction, systems/infrastructure engineering and physical acceptance testing.
- **OpenAI Codex** — substantial AI assistance with implementation, debugging,
  tests and documentation, reviewed and physically tested by the maintainer.

The maintainer is a systems engineer with no professional programming background,
developing this adaptation for a practical camera-monitoring use case. The project
aims to keep upstream components current
and provide fixes/features as needed. It is not an official datarhei release.

Application source is **Apache-2.0**; this FFmpeg configuration is
**GPL-3.0-or-later**. Dependencies retain their own licenses. Original authorship,
copyright and notices remain applicable: [LICENSE](LICENSE), [NOTICE](NOTICE),
[MODIFICATIONS.md](MODIFICATIONS.md), [component licenses and sources](THIRD_PARTY.md).
