# Frigate integration

Restreamer can stabilize or transcode an IP camera once and publish the resulting
H.264 stream over the bundled MediaMTX server. Frigate can then consume that relay
instead of opening another connection to the camera. This is particularly useful
for cameras that expose HEVC/H.265, tolerate few simultaneous clients, or reconnect
poorly.

```text
IP camera (H.265 or H.264)
        |
        v
Restreamer ingest and optional H.264 hardware transcode
        |
        v
MediaMTX RTSP relay on the Restreamer host
        |
        v
Frigate go2rtc -> Frigate detect / record / live view
```

Restreamer can reconnect to a failed source and normalize its output, but it cannot
reconstruct packets that the camera or network never delivered. A transcode is a
useful protocol boundary, not a time machine.

## Create the Restreamer relay

1. Add the camera's direct RTSP URL as a Restreamer network source. Keep camera
   credentials on the LAN and out of screenshots, logs, and bug reports.
2. If the source is already usable H.264, prefer stream copy. For HEVC/H.265, select
   an H.264 encoder supported by the deployment host. The unified image exposes
   NVENC, VA-API, Quick Sync, and Vulkan Video options when the corresponding device
   and host driver are available.
3. Add a **MediaMTX LAN relay** publication. Give it a unique path such as
   `printer-one` and set **LAN hostname or IP** to the Restreamer host address that
   Frigate can reach.
4. Before involving Frigate, verify the exact relay:

   ```sh
   ACCEPT_RELAY_REPORT_FILE=restreamer-frigate-relay.json \
     scripts/accept-relays.sh printer-one
   ```

The resulting source for Frigate is:

```text
rtsp://RESTREAMER_LAN_IP:8554/printer-one
```

Use **MediaMTX resilient LAN relay** and one of the fixed paths such as
`resilient/01` when a connected reader must survive source outages and display an
offline slate. Resilient paths are deliberately video-only; do not assign Frigate's
`audio` role to one. Use the ordinary relay when audio is required.

## Recommended Frigate configuration

Let Frigate's bundled go2rtc process hold the single connection to Restreamer. The
camera input then reads Frigate's local restream. Keep the go2rtc stream key, camera
name, and localhost path identical so Frigate can also map its live-view modes.

```yaml
go2rtc:
  streams:
    printer_one:
      - rtsp://RESTREAMER_LAN_IP:8554/printer-one

cameras:
  printer_one:
    enabled: true
    ffmpeg:
      inputs:
        - path: rtsp://127.0.0.1:8554/printer_one
          input_args: preset-rtsp-restream
          roles:
            - detect
            - record
```

Add `audio` to the roles only when using an ordinary MediaMTX relay that actually
publishes audio and Frigate audio detection is enabled. Recording audio may also
require an appropriate Frigate recording output preset; that policy belongs in
Frigate rather than being silently invented by Restreamer.

Frigate's current documentation recommends `preset-rtsp-restream` when its own
go2rtc RTSP endpoint is the input. It also notes that each role can be assigned to
only one input per camera. See the official
[camera configuration](https://docs.frigate.video/configuration/cameras),
[restream](https://docs.frigate.video/configuration/restream/), and
[FFmpeg preset](https://docs.frigate.video/configuration/ffmpeg_presets/) guides.

## Direct Frigate input

For a minimal setup, Frigate can connect straight to the MediaMTX relay. Use the
generic RTSP input preset because this URL is not Frigate's localhost go2rtc
restream:

```yaml
cameras:
  printer_one:
    enabled: true
    ffmpeg:
      inputs:
        - path: rtsp://RESTREAMER_LAN_IP:8554/printer-one
          input_args: preset-rtsp-generic
          roles:
            - detect
            - record
```

The direct form is valid, but the recommended go2rtc form shares one upstream
connection between Frigate detection, recording, and live view. Do not use
`preset-rtsp-restream` merely because another server is restreaming the camera; in
Frigate that preset specifically describes its local go2rtc source.

## Troubleshooting

- Confirm the Restreamer host's TCP port `8554` is reachable from the Frigate host.
  Do not expose RTSP to the public internet; use a private LAN or VPN.
- Test the published URL with `ffprobe` or VLC before changing Frigate. If it cannot
  decode there, Frigate is an innocent bystander for once.
- Run `docker exec restreamer restreamer-hardware-report --verify` to prove that the
  selected GPU backend can encode on this host. A codec appearing in a menu proves
  that the binary contains it, not that the driver, container runtime, and silicon
  are cooperating.
- If Frigate reports `404 Not Found` for its localhost stream, verify that the
  `go2rtc.streams` key exactly matches the name after port `8554` in the localhost
  URL.
- Use one-second-or-shorter GOPs and no B-frames for transcoded LAN feeds. The
  unified hardware presets already use those low-latency defaults.
- A resilient path switches between a 1920x1080 fallback slate and the live source.
  Configure detection zones and thresholds with that resolution change in mind, or
  use the ordinary relay if a fixed geometry is mandatory.

Automated tests verify the RTSP interface, concurrent sub-second first-frame reads,
and resilient offline/live/offline switching. A real Frigate deployment with the
target camera, network, and accelerator remains the final acceptance test.
