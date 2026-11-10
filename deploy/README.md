# Container deployment

Start the unified container without passing through a GPU:

```sh
docker compose -f deploy/compose.yaml up -d
```

The primary Compose file exposes `/dev/dri` for Intel and AMD acceleration by
default. Set the host's actual `video` and `render` group IDs before starting it:

```sh
RENDER_GID="$(getent group render | cut -d: -f3)" \
VIDEO_GID="$(getent group video | cut -d: -f3)" \
docker compose -f deploy/compose.yaml up -d
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

For measured RTSP/RTMP results and a camera/encoder-independent test procedure,
see [low-latency validation](../docs/low-latency-validation.md). Ongoing frame age
and first-frame startup are separate checks; neither alone establishes optical
camera-to-display latency.

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

### Keep a dashboard stream available while its camera is offline

Choose **MediaMTX resilient LAN relay** instead of the ordinary relay when a printer
dashboard must keep receiving video while its camera, ingest, or Restreamer process
reconnects. Select a unique slot for every publication from the 16 explicitly
configured resilient paths, for example:

```text
rtsp://mediamtx:8554/resilient/01
```

MediaMTX immediately serves its built-in H.264 offline slate on that path, replaces
it with the live publisher when Restreamer connects, and returns to the slate when
the publisher leaves. Existing readers remain connected across both transitions.
The Compose smoke gate holds one RTSP reader open and requires it to decode both the
1920x1080 slate and a 320x180 live test publisher before switching back.

The resilient preset intentionally removes audio. MediaMTX requires an arriving
publisher to have exactly the track layout declared for its offline stream; an
H.264-only fallback cannot be replaced by H.264 plus AAC or Opus. The ordinary
**MediaMTX LAN relay** remains available when audio is required. Maintaining two
honest presets is preferable to one checkbox that produces a valid-looking URL and
a rejected publisher—configuration already has enough opportunities for theatre.
MediaMTX also forbids `alwaysAvailable` on wildcard paths, which is why these are
explicit numbered slots rather than arbitrary channel-name paths.

Other LAN clients can read each stream directly:

```text
rtsp://RESTREAMER_LAN_IP:8554/printer-one
http://RESTREAMER_LAN_IP:8889/printer-one
```

Frigate can consume the same RTSP publication, either directly or through its
bundled go2rtc restream. See the [Frigate integration guide](../docs/frigate.md) for
current YAML, H.265-to-H.264 transcoding, resilient-path limitations, and an
acceptance checklist.

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

### RTP/MPEG-TS multicast output

For receivers that require an RTP-wrapped MPEG transport stream, add an **MPEG-TS**
publication and select **RTP/MPEG-TS** as its protocol. Enter only the destination
host and port, for example:

```text
239.255.0.1:5001
```

The publication uses FFmpeg's `rtp_mpegts` muxer and produces this destination by
default:

```text
rtp://239.255.0.1:5001?pkt_size=1316&ttl=1
```

Packet size and multicast TTL are available under **Advanced settings**. A TTL of
one confines multicast traffic to the local subnet unless deliberately increased.
The RTP mode also inserts available video codec headers at keyframes. For H.264
receivers that may join after a stream starts, use a one-second GOP and avoid B-frames
so the next independently decodable frame is never far away. UDP and TCP MPEG-TS
publications keep using the ordinary `mpegts` muxer; existing saved publications are
not silently converted into RTP.

The RTSP, RTP, RTCP, WebRTC HTTP, and WebRTC ICE ports are intended for the trusted
LAN. Do not publish them through the public reverse proxy without authentication and
firewall rules. Public viewers should continue using Restreamer's authenticated HLS
player path, where several seconds of buffering are useful rather than tragic.
