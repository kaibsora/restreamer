# Container deployment

Start the unified container without passing through a GPU:

```sh
docker compose -f deploy/compose.yaml up -d
```

To test an image built locally as `restreamer:local`:

```sh
RESTREAMER_IMAGE=restreamer:local \
docker compose -f deploy/compose.yaml up -d
```

For Intel or AMD acceleration, expose the DRM render nodes and set the host's
actual `video` and `render` group IDs:

```sh
RENDER_GID="$(getent group render | cut -d: -f3)" \
VIDEO_GID="$(getent group video | cut -d: -f3)" \
docker compose -f deploy/compose.yaml -f deploy/compose.dri.yaml up -d
```

For NVIDIA acceleration, install NVIDIA Container Toolkit on the host and use:

```sh
docker compose -f deploy/compose.yaml -f deploy/compose.nvidia.yaml up -d
```

Copy `compose.camera-example.yaml`, enumerate every required `/dev/videoN` device,
and include the copy as another Compose override. Device numbers may change after a
reboot; persistent udev symlinks are recommended for more than one USB camera.

If WebRTC clients receive an unreachable Docker address, advertise the host's LAN IP
or DNS name to MediaMTX:

```sh
RESTREAMER_WEBRTC_HOSTS="192.168.1.20,restreamer.lan" \
docker compose -f deploy/compose.yaml up -d
```

After startup, inspect what the container can actually use:

```sh
docker exec restreamer restreamer-hardware-report
```

Then run an active encode acceptance test on the deployment host:

```sh
docker exec restreamer restreamer-hardware-report --verify
```

This encodes a real frame with every detected backend: NVENC, VA-API, Intel Quick
Sync, and hardware Vulkan Video. A compiled encoder is listed even when Docker cannot
reach its driver; `--verify` turns that decorative optimism into a failing exit code.
Use `--require nvenc`, `--require vaapi`, `--require qsv`, or
`--require vulkan` (repeatable) to assert the backend intended for that host. A
requirement also enables active verification, so a different working GPU cannot
camouflage the missing one.
For a Vulkan GPU that is not FFmpeg device `0`, set
`RESTREAMER_VULKAN_DEVICE=<index>` in the Restreamer service environment.
On multi-GPU VA-API/Quick Sync hosts, set `RESTREAMER_VAAPI_DEVICE` and
`RESTREAMER_QSV_DEVICE` to the intended mapped DRM nodes. The report still lists
every usable node, but active verification targets those selections instead of
quietly certifying the first GPU returned by the kernel.

An encoder appearing in `ffmpeg -encoders` proves it was compiled. Successful
`vainfo`, `vulkaninfo`, or `nvidia-smi` output proves that the corresponding host
runtime reached the container. A successful `--verify` additionally proves the
runtime accepted an encode. Those are separate facts, despite decades of GPU software
trying to make them feel like one exciting mystery.

For a GPU exposed to an Actions Runner Controller scale set, dispatch the
**Accept Restreamer hardware** workflow and select the required backend. The workflow
uses the `restreamer-linux` scale set by default, never the unsupported ARC
`self-hosted` label, and retains the immutable image digest plus active-encode output
as a 30-day artifact. Configure `RESTREAMER_HARDWARE_RUNNER_LABELS` as a JSON label
array when GPU jobs need a dedicated ARC scale set.

The workflow's first container is a small daemon-side preflight. On an ARC DinD
runner, `/dev/dri` must be a hostPath mounted into the privileged **dind** container,
not merely into the runner container. NVIDIA runners additionally need the GPU
resource assigned to dind and its nested Docker daemon configured with NVIDIA
Container Toolkit. See the repository README's ARC section before blaming FFmpeg;
it cannot encode on hardware the daemon has carefully hidden from it.

Validate all real camera inputs concurrently from the same network and device
namespace used by Restreamer:

```sh
ACCEPT_REPORT_FILE=restreamer-acceptance.json \
ACCEPT_HARDWARE_BACKENDS=vaapi,qsv \
  scripts/accept-deployment.sh \
  v4l2:/dev/video0 \
  rtsp://printer-one.lan:8554/stream.h264 \
  http://printer-two.lan/webcam/?action=stream
```

The command first runs the active hardware encode verification, checks the
Restreamer API, requires a decoded frame from every source in less than 1000ms, and
then sustains every decode concurrently for ten seconds. Set
`ACCEPT_VERIFY_HARDWARE=false` only for a deliberate software-only deployment. Use
`ACCEPT_HARDWARE_BACKENDS=nvenc`, `vaapi`, `vaapi,qsv`, or `vulkan` to require the
accelerator expected on the target host. Use
`ACCEPT_MAX_FIRST_FRAME_MS`, `ACCEPT_PROBE_TIMEOUT_SECONDS`,
`ACCEPT_SAMPLE_SECONDS`, and `ACCEPT_MIN_SAMPLE_FPS` to define the acceptance limits.
The optional JSON report records the container tag, immutable repository digests, OCI
source labels, and reproducible camera evidence without exposing URL credentials;
console output continues to number cameras instead of helpfully donating passwords to
CI logs.

Startup and sustained decoding are software-path checks, not glass-to-glass latency
measurements. Record a visible millisecond clock at the camera and dashboard, or use
equivalent optical instrumentation, before claiming the physical deployment is below
one second. Computers are excellent at measuring themselves and surprisingly poor at
noticing the photons they never observed.

## LAN RTSP and WebRTC

### SRT ingest is not the player

SRT can keep contribution latency low between OBS, another encoder, and Restreamer,
but it does not determine how the resulting stream is viewed. Restreamer's public
player uses segmented HLS and deliberately buffers; selecting SRT as the input does
not make that HLS player sub-second. Protocol names are useful, but sadly not magic
spells.

For low-latency LAN viewing, ingest the SRT publisher as usual, then add a
**MediaMTX LAN relay** publication and give Mainsail or another browser the displayed
WebRTC URL. Native clients may use the corresponding RTSP URL. Keep the source GOP at
one second or shorter and avoid B-frames when the encoder allows it. The automated
camera-stack test exercises this complete SRT-to-Core-to-MediaMTX path and requires
first-frame RTSP readback below one second, covering the topology reported in
[upstream issue #942](https://github.com/datarhei/restreamer/issues/942).

### Ingest from Crowsnest or an IP camera

Crowsnest does not consume an arbitrary RTSP stream. In `camera-streamer` mode it can
*produce* one when `enable_rtsp: true` is supported by that Crowsnest release. The
usual source URL is:

```text
rtsp://PRINTER_LAN_IP:8554/stream.h264
```

Add that URL—or the equivalent URL from a standalone IP camera—as a Restreamer
network source. Crowsnest v5 removed its RTSP options after upstream build failures,
so treat this source path as version-dependent. A printer that only exposes MJPEG
can still be ingested through its direct HTTP stream URL.

### Publish back to the printer dashboard

The deployment includes MediaMTX as the LAN-facing real-time origin. In Restreamer,
add the **MediaMTX LAN relay** publication for each camera. The preset selects H.264,
generates a safe path from the channel name, and uses the bundled sidecar at
`rtsp://mediamtx:8554` with zero mux delay. Give every camera a unique stream path,
such as:

```text
rtsp://mediamtx:8554/printer-one
rtsp://mediamtx:8554/printer-two
```

Set **LAN hostname or IP** to the Restreamer host address reachable by the printer
dashboards. The form then displays usable RTSP and WebRTC URLs instead of a template
that users must edit by hand. When the UI is opened through the LAN address, that
hostname is selected automatically; override it when configuring through a public
reverse proxy.

Prefer stream copy when the camera already emits browser-compatible H.264. If it
must be encoded, select a low-latency hardware encoder; the unified hardware presets
default to a one-second GOP and no B-frames. The MediaMTX publication defaults to
RTSP over TCP for a reliable wired LAN and also permits UDP where minimum delay
matters more than packet-loss recovery. The generic RTSP publication remains
available for non-MediaMTX servers and unusual protocol tuning.

Other LAN clients can read each stream directly:

```text
rtsp://RESTREAMER_LAN_IP:8554/printer-one
http://RESTREAMER_LAN_IP:8889/printer-one
```

After creating the Restreamer publications, validate the exact named paths that the
printer dashboards will consume:

```sh
ACCEPT_RELAY_REPORT_FILE=restreamer-relays.json \
  scripts/accept-relays.sh printer-one printer-two
```

The command checks every WebRTC player and WHEP discovery endpoint from the
deployment host, then decodes every corresponding RTSP stream concurrently from
inside the Restreamer container.
The RTSP checks inherit `ACCEPT_MAX_FIRST_FRAME_MS`, `ACCEPT_SAMPLE_SECONDS`, and
`ACCEPT_MIN_SAMPLE_FPS`; the defaults require a first frame below one second and a
ten-second sustained decode. If MediaMTX is not using the Compose defaults, set
`RESTREAMER_MEDIAMTX_RTSP_BASE` to the RTSP URL visible inside Restreamer and
`RESTREAMER_MEDIAMTX_WEBRTC_BASE` to the HTTP(S) URL visible to Mainsail clients.

For Mainsail/Moonraker, configure the WebRTC endpoint rather than handing a browser
an RTSP URL it cannot play:

```ini
[webcam printer_one]
service: webrtc-mediamtx
stream_url: http://RESTREAMER_LAN_IP:8889/printer-one
snapshot_url:
target_fps: 25
```

Use the stream path shown above, without adding `/whep`. Mainsail's
`webrtc-mediamtx` client appends `/whep` itself and performs the WHEP signaling
exchange with MediaMTX. The relay acceptance command verifies that discovery
endpoint as well as decoding the corresponding RTSP stream.

Moonraker identifies `webrtc-mediamtx` as a supported Mainsail webcam service.
Moonraker stores the URL and Mainsail consumes it; neither Moonraker nor Crowsnest
proxies the video. Crowsnest can continue handling locally attached cameras while
Mainsail displays either source.

The RTSP, RTP, RTCP, WebRTC HTTP, and WebRTC ICE ports are intended for the trusted
LAN. Do not publish them through the public reverse proxy without authentication and
firewall rules. Public viewers should continue using Restreamer's authenticated HLS
player path, where several seconds of buffering are useful rather than tragic.
