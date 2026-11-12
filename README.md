# CQComber Restreamer

[RC-2 release and exact image/source record](https://github.com/kaibsora/restreamer/releases/tag/rc-2)
— published as `ghcr.io/kaibsora/restreamer:rc-2` and `:latest` for
`linux/amd64` and `linux/arm64`. Docker selects the matching architecture.

An independent adaptation of **[datarhei Restreamer](https://github.com/datarhei/restreamer)**,
maintained by **CQComber** (GitHub: **kaibsora**). One source repository and one
multi-platform Linux application image combine the web UI, Core backend and a hardware-enabled
FFmpeg build. MediaMTX is an optional companion service for LAN delivery.

**RC-1:** the maintainer completed the physical acceptance checklist, including an
overnight run, simultaneous cameras, hot-plug, camera controls, rotation and
acceptable local delay. This is a release candidate, with the limitations below.
Intel VA-API and Quick Sync have physical validation; **AMD and NVIDIA GPUs are
untested as of publication**. See the [acceptance record](docs/rc-1-acceptance.md)
and [validation report](docs/physical-validation.md). Physical acceptance covered
video; audio was outside that scope.

**RC-2:** native AMD64/ARM64 builds passed automated acceptance, including four
concurrent synthetic streams on AMD64 and two on a Raspberry Pi 5. The exact
release image also passed Intel encode checks and live USB camera playback;
all saved configurations and start/stop orders survived recreation. See the
[RC-2 acceptance record](docs/rc-2-acceptance.md). Pi hardware encoding remains
physically untested; Pi 5 uses software encoding or camera H.264 passthrough.

This is a personal project by a systems engineer with a printer-monitoring use
case, not a professional programmer. Refactoring, updates, features, documentation
and tests use substantial AI coding assistance. Physical results and automated
checks describe what was tested; they do not guarantee every camera, driver or
network combination. The project attempts to keep upstream components current,
while providing bug fixes and features on demand.

## Quick start

Requirements: a **Linux x86-64 or 64-bit ARM** host, Docker Engine and **Docker
Compose 2.30+**. Hardware encoding requires compatible host devices/drivers.
Docker Desktop USB/GPU passthrough is outside the validated deployment target.
The `latest` and `rc-2` tags include native AMD64 and ARM64 images. The immutable
first release, `rc-1`, remains AMD64-only.
See [Raspberry Pi deployment and hardware limits](docs/raspberry-pi.md).

```sh
git clone --branch main https://github.com/kaibsora/restreamer.git
cd restreamer
```

The primary Compose file maps `/dev/dri` by default, as needed for Intel/AMD GPUs.
For a host with that directory, start with:

```sh
docker compose -f deploy/compose.yaml up -d
```

For a CPU-only host **without `/dev/dri`**, clear that mapping:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.cpu.yaml up -d
```

For a **64-bit Raspberry Pi**, use the dedicated V4L2 hot-plug override:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.raspberrypi.yaml up -d
```

Pi 5 has no H.264 hardware encoder. Select **H.264 (libx264)** for CPU encoding:
Restreamer launches FFmpeg, whose `libavcodec` interface calls `libx264` to encode
the video. This uses the same underlying software encoder discussed in Raspberry
Pi's [H.264 encoding performance paper](https://pip-assets.raspberrypi.com/categories/685-app-notes-guides-whitepapers/documents/RP-010033-WP-1-H.264%20encoding%20performance%20on%20Raspberry%20Pi%205_series%20computers.pdf).
Its benchmark results depend on the tested settings and workload; they are not a
guarantee for every camera, filter or concurrent-stream configuration. A camera
that supplies compatible H.264 can use stream copy to avoid re-encoding.

The maintainer has successfully tested the ARM image on a Pi 5 with USB cameras.
Pi 4 can use V4L2 M2M when supported by its host kernel; physical Pi hardware
encoder validation remains outstanding. Docker selects the architecture
automatically from a multi-platform tag.

Open **`http://HOST:8080/ui/`** and complete the initial account/setup screens.
Use a strong password. Existing installations retain their account and settings.
Configuration and media persist in the `restreamer-config` and `restreamer-data`
named volumes. Keep the same Compose project name and files when updating so
Docker uses the same volumes.

The application image stays at `ghcr.io/kaibsora/restreamer`; the new product name
does not change repository or package ownership.

| Image tag | Purpose |
| --- | --- |
| `rc-2` | Fixed multi-platform release candidate; recommended for reproducible testing |
| `rc-1` | Preserved first release candidate, AMD64 only |
| `latest` | Most recently accepted public release; updated only by explicit promotion |
| `build-<run>-<attempt>` / `@sha256:<digest>` | Exact candidate/release build, useful for rollback |
| `ffmpeg-hardware-*` / `ffmpeg-sources-*` | Internal runtime/source images, not the complete application |

The checked-in Compose image is `latest`. To pin a release, change its `image:`
line to `ghcr.io/kaibsora/restreamer:rc-2` or the published digest.

The footer's generated `adjective-noun-number` name is seeded from the application
Git commit. It stays the same across architectures/restarts and changes with
the source revision. The original configured Core instance name is retained.

## GPU encoding

The UI exposes compiled encoders, but the GPU must support the requested codec,
resolution and driver API. Run a short real encode check after deployment:

```sh
docker exec restreamer restreamer-hardware-report --verify
```

| Hardware | Deployment and encoder selection | Physical status |
| --- | --- | --- |
| Intel | Map `/dev/dri`; choose H.264/HEVC VA-API or Intel Quick Sync. Set the hardware device to the correct `/dev/dri/renderD*` node. | UHD 630 VA-API / Quick Sync validated; codecs depend on GPU generation |
| AMD | Map `/dev/dri`; choose a VA-API encoder, or Vulkan Video when supported by GPU and Mesa driver. | Compiled support; physical GPU untested |
| NVIDIA | Install compatible NVIDIA host driver and Container Toolkit; use the NVIDIA override; choose NVENC. | Compiled support; physical GPU untested |
| CPU | Use `compose.cpu.yaml` if `/dev/dri` is absent; select H.264 libx264 or another software encoder. | Validated; consumes more CPU |

Set group IDs to match the host's device ownership when needed. For example:

```sh
export RENDER_GID="$(stat -c %g /dev/dri/renderD128)"
export VIDEO_GID="$(getent group video | cut -d: -f3)"
docker compose -f deploy/compose.yaml up -d
```

On multi-GPU hosts inspect `/dev/dri` and select the actual node; `renderD128` is
an example, not a universal GPU identifier. `RESTREAMER_VAAPI_DEVICE` and
`RESTREAMER_QSV_DEVICE` select report/verification devices; the UI encoder's
hardware-device field controls an individual stream. Vulkan uses
`RESTREAMER_VULKAN_DEVICE` (default index `0`). Require a specific working backend:

```sh
docker exec restreamer restreamer-hardware-report --require vaapi
# Alternatives: --require qsv, --require nvenc, --require vulkan
```

For NVIDIA-only hosts without `/dev/dri`:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.cpu.yaml -f deploy/compose.nvidia.yaml up -d
```

For mixed NVIDIA + Intel/AMD hosts, omit `compose.cpu.yaml` to retain DRM devices.
The NVIDIA override uses `gpus: all`, which requires Compose 2.30+;
configure [NVIDIA Container Toolkit](https://docs.nvidia.com/datacenter/cloud-native/container-toolkit/latest/install-guide.html)
on the host before starting. The image includes the codec support, not a host driver.

## USB cameras, controls and hot-plug

For integrated hot-plug support, append `-f deploy/compose.hotplug.yaml` to your
chosen Compose command. For an Intel/AMD host:

```sh
export VIDEO_GID="$(getent group video | cut -d: -f3)"
docker compose -f deploy/compose.yaml -f deploy/compose.hotplug.yaml up -d
```

This uses the integrated Core device watcher, a read-only host `/dev` mount and
V4L2 device access rules. It needs no external service, privileged container or
Docker socket. Do not combine hot-plug mode with explicit camera device binds.
For fixed devices instead, adapt [compose.camera-example.yaml](deploy/compose.camera-example.yaml).
See [USB hot-plug](docs/usb-hotplug.md) for permissions and device identity details.
For CPU/NVIDIA-only hosts, put the hot-plug override **after** `compose.cpu.yaml`
so it adds the camera's video group back.

In **Add video source → Hardware source**, select a capture device and then:

1. Choose **Format** (for example MJPEG, raw YUYV or native H.264), **Resolution**
   and **Frame rate**. Only modes advertised by that device/driver are listed.
2. Probe the selected capture mode. **Detected video track** lists the verified
   input tracks, usually one; it is not the list of all camera resolutions.
3. Choose decoding/encoding. Native H.264 may use stream copy when compatible;
   raw and MJPEG inputs need encoding for HLS/RTMP/browser-compatible output.
4. Adjust **Camera controls** such as exposure, brightness, focus or zoom when
   the driver provides them. Unsupported controls cannot be invented by the UI.
5. Set source image rotation if needed. Rotation changes encoded output for all
   viewers; stream copy cannot apply a rotation filter.

IP cameras use **Network source** with the camera's supported URL and credentials.
Capture and driver control settings are device-specific. Camera controls may reset
after a disconnect/reboot and are not automatically persisted/reapplied. Driver
advertising a mode does not guarantee adequate USB bandwidth for several cameras;
reduce resolution/rate or use separate USB controllers when necessary.

## Local streams, printers and public viewing

The built-in player uses **HLS**. It buffers and is not a sub-second player.
For local clients, use RTSP/RTMP or a MediaMTX WebRTC relay. For fast starts use a
short encoder keyframe interval (about one second or less) and avoid B-frames.
Native camera H.264 can have a long fixed GOP: copying it may make clients wait
many seconds for their first keyframe. Re-encode with a short GOP if needed.

For Mainsail/Fluidd:

1. Enable Core RTMP and the channel's RTMP output in the UI.
2. Add a **MediaMTX LAN relay** publication. Choose its live **RTMP** source
   (or a supported live SRT source), rather than HLS. Relaying HLS retains HLS delay.
3. Publish to the Compose relay at `rtsp://mediamtx:8554` with a unique stream path.
4. In the printer dashboard choose **WebRTC (MediaMTX)** and use
   `http://HOST:8889/STREAM_PATH`, without appending `/whep`.

Native clients can read `rtsp://HOST:8554/STREAM_PATH` (TCP recommended).
Mainsail/Fluidd do not directly play arbitrary RTMP/SRT streams. Crowsnest normally
captures/provides cameras; it is not an arbitrary RTSP input adapter. These relays
let the dashboard consume the shared camera without opening the same USB device
from two independent capture processes.

If ICE advertises an unreachable container address, set
`RESTREAMER_WEBRTC_HOSTS=HOST_LAN_IP` before Compose startup; comma-separated
additional addresses are supported. WebRTC needs reachable UDP port 8189 and
signaling port 8889. HTTPS dashboards require HTTPS signaling, with a suitable
reverse proxy. See [LAN deployment instructions](deploy/README.md#lan-rtsp-and-webrtc)
and [latency measurements and limitations](docs/low-latency-validation.md).

For public HLS pages, configure the correct externally reachable hostname in the
UI, terminate HTTPS at a dedicated reverse-proxy hostname, and forward the whole
site to port 8080. [NGINX, Caddy and IIS examples](docs/reverse-proxy.md) cover the
required headers and upload handling. Subpath hosting is not the documented setup.
Do not expose the unauthenticated LAN relay directly to the internet; add appropriate
network access controls/authentication before sharing it beyond a trusted network.

## Ports and persistent data

| Host port | Service |
| --- | --- |
| 8080/TCP | UI, API, HLS/public pages |
| 8181/TCP | Core HTTPS, if enabled |
| 1935 / 1936 TCP | Core RTMP / RTMPS, when enabled |
| 6000/UDP | Core SRT, when enabled |
| 8554/TCP | MediaMTX RTSP |
| 8000 / 8001 UDP | MediaMTX RTP/RTCP, if used |
| 8889/TCP | MediaMTX WebRTC signaling/page |
| 8189/UDP | MediaMTX WebRTC ICE media |

Port publication alone does not enable the corresponding Core service. Unused
ports/services may be removed from your own deployment. Back up the named volumes
and use the UI's configuration export before upgrading; exported configurations
can include camera passwords and publication keys, so store them privately.

## Update, recreate and roll back

From the existing checkout, use the **same project name and override files** used
at installation. For the Intel/AMD hot-plug example:

```sh
git pull --ff-only
docker compose -f deploy/compose.yaml -f deploy/compose.hotplug.yaml pull restreamer
docker compose -f deploy/compose.yaml -f deploy/compose.hotplug.yaml up -d --no-deps --force-recreate restreamer
docker compose -f deploy/compose.yaml -f deploy/compose.hotplug.yaml logs --tail 80 restreamer
```

This retains volumes. Manually started sources with autostart disabled may need
starting again after recreation. To roll back, change the Compose image to a known
immutable tag/digest, then run the pull and recreate commands again. To stop/remove
the deployment's containers and network while retaining data, run the same Compose
command with `down`. Adding `--volumes` deletes its persistent data.

## Release channels and upstream updates

`main` is the accepted release branch. `development` is for subsequent changes and
testing. GitHub Actions uses the custom `restreamer-linux` runner pool. Routine
builds produce unique build tags and **cannot update `latest`**. After review
and physical acceptance, the separate **Promote accepted release** workflow on
`main` promotes an exact digest to a new `rc-N` tag and `latest`, without rebuilding.
Existing release tags cannot be moved to a different digest.

Scheduled/manual builds resolve current FFmpeg master to an immutable commit;
manual builds can select an exact commit or release. A fresh build is a candidate,
not automatically an accepted release. The FFmpeg banner may contain a historical
version string; use the recorded source SHA/build provenance rather than guessing
its APIs from that banner. Source images, notices, provenance and SBOMs accompany
binary builds. [Contributing](CONTRIBUTING.md) describes development; see the
[release gate](docs/rc-1-release-plan.md) for release evidence.

## Credit and licenses

Original Restreamer was created by **datarhei / FOSS GmbH and contributors**.
This adaptation combines their [application](https://github.com/datarhei/restreamer),
[UI](https://github.com/datarhei/restreamer-ui), [Core](https://github.com/datarhei/core)
and [FFmpeg build integration](https://github.com/datarhei/ffmpeg). Their work made
this project possible. This is not an official datarhei release; report fork-specific
issues to [this repository](https://github.com/kaibsora/restreamer/issues).

Application source remains **Apache-2.0**, with upstream copyright/licenses preserved.
The bundled FFmpeg configuration is **GPL-3.0-or-later** and dependencies retain their
own licenses. See [LICENSE](LICENSE), [NOTICE](NOTICE), [modification notices](MODIFICATIONS.md)
and the [component inventory and exact source-download instructions](THIRD_PARTY.md).
Credit also remains visible in the UI's About dialog. The CQComber name identifies
the maintained adaptation and does not claim authorship of the original code.
