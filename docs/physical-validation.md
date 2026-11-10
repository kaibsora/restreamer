# Physical video validation

Latest verified image: `ghcr.io/kaibsora/restreamer:sha-027760a`.

Published image digest:
`sha256:3ac0a5007ccbab959d8cc018bc399f643f031762257ff7c5cbab2a2d368bea4b`.

The initial four-stream baseline below used `sha-c545e64`. Updated-image results
are recorded at the end of this document.

The validation host used an Intel UHD Graphics 630, a Logitech USB camera at
640x480, and a Sonix USB camera at 1280x720. Both cameras used MJPEG capture
at 15 FPS. Two additional FFmpeg virtual sources (test bars and Game of Life)
ran concurrently at 640x480 and 15 FPS. Audio was disabled.

All four sources encoded H.264 through VA-API, each producing HLS and RTSP.
The container was restarted with all four process configurations saved. Every
process resumed, and all eight outputs decoded concurrently afterward. Browser
players also showed advancing decoded-frame counts after the restart.

| Source | RTSP first decoded frame after restart |
| --- | ---: |
| Logitech USB | 892 ms |
| Sonix USB | 850 ms |
| Virtual test bars | 695 ms |
| Virtual Game of Life | 703 ms |

These are stream-acquisition measurements, including starting the reader. They
are **not optical camera-to-display latency measurements**. HLS browser playback
was used to verify video correctness and survival, not sub-second LAN latency.

The tested RTSP encoding used no B-frames, a seven-frame GOP at 15 FPS,
`-async_depth 1`, RTSP over TCP, and `-muxdelay 0`. A prior one-second GOP test
produced a 1034 ms acquisition time on the Logitech, so the shorter GOP matters.
These settings describe the physical test configuration, not every UI preset.

Core advertised 192 muxers and 373 demuxers after the format parser correction;
the publication menu enabled RTSP, RTMP, HLS, MPEG-TS, and MediaMTX services.
These results validate this host and camera combination; other GPUs, camera modes,
and network conditions still require acceptance testing.

## Hardware findings

- VA-API H.264 and HEVC passed on the updated deployed image.
- The UHD 630 does not expose Vulkan Video encode-queue support in this runtime.
- Quick Sync H.264 and HEVC passed on the updated deployed image. The runtime
  includes `libmfx1`, `libmfx-gen1.2`, and the full-feature Intel media driver.
  Encoder mappings use system-memory NV12 and a derived VA-API/QSV device.
  H.264 defaults to low-power encoding, with a UI override available.
- The optional [USB hot-plug helper](usb-hotplug.md) was tested with both cameras
  using stable `/dev/v4l/by-id` sources. A targeted `uvcvideo` driver detach removed
  the Logitech capture node and alias from the running container. The Sonix and
  both virtual streams continued advancing. After driver reattachment, all four
  streams advanced again within 6.1 seconds, with the same container ID. This
  tests software detach/reattach, not a physical cable unplug.
  A subsequent container restart also restored both dynamically synchronized
  cameras and both virtual streams; all eight HLS/RTSP outputs decoded. RTSP
  first-frame acquisition measured 467/867 ms for the cameras and 794/802 ms for
  the virtual sources in that run.

Camera images and host credentials are deliberately excluded from this repository.

## Additional host checks

Both USB cameras passed targeted driver detach/reattach with the hot-plug helper.
The Sonix recovered within 4.1 seconds; the Logitech within 6.1 seconds. Each test
kept the other three sources advancing and preserved the container ID.
Four simultaneous browser WebRTC players also decoded the two cameras and two
virtual sources. The repository relay acceptance check passed WHEP discovery and
sustained RTSP decoding on all four paths (at least 12 FPS over five seconds).

A disposable container with Ubuntu's `intel-media-va-driver-non-free`, `libmfx1`
and `libmfx-gen1.2` encoded 50 frames each through H.264/HEVC VA-API and H.264/HEVC
Quick Sync. The free-kernel Intel driver only advertised H.264 encode on this
host. Intel documents the [driver package feature differences](https://github.com/intel/media-driver).
VP9 encoding remained unavailable on this UHD 630; it only advertised VP9 decode.
These diagnostic package changes do not modify the running production container.

## Shorter keyframe intervals

A Windows-client RTSP check with the seven-frame GOP measured 1035 ms on the
Logitech, exceeding the one-second acquisition target. With a four-frame GOP at
15 FPS (a requested 0.25-second interval, rounded to whole frames), the same
client measured 751 ms Logitech, 681 ms Sonix, 549 ms test bars and 748 ms Game of
Life. All eight HLS/RTSP outputs also passed concurrent decode again. These
single-run acquisition values are not a latency guarantee or optical latency.

The UI now offers 0.25- and 0.5-second keyframe intervals and preserves fractional
FPS/intervals when generating encoder options. Previously integer parsing turned
sub-second intervals into a zero-frame GOP.

## Updated image verification

The published `sha-027760a` runtime and the deployed unified image both passed
active VA-API and Quick Sync verification. H.264 QSV, HEVC QSV and HEVC VA-API each
encoded a 50-frame file, and all 50 frames decoded successfully afterward.
A fifth, temporary Core-managed Game of Life source used H.264 QSV while the
four baseline streams ran; its HLS and RTSP outputs each decoded 75 frames over
five seconds. That temporary QSV process was removed after testing.

After restarting the updated container, all four baseline sources resumed and
all eight HLS/RTSP outputs decoded concurrently with a four-frame GOP at 15 FPS.

| Source | RTSP first decoded frame after updated-image restart |
| --- | ---: |
| Logitech USB | 543 ms |
| Sonix USB | 546 ms |
| Virtual test bars | 621 ms |
| Virtual Game of Life | 639 ms |

These remain acquisition measurements, not optical camera-to-display latency.
NVIDIA and AMD hardware have not been physically validated on this Intel host.

The updated image also passed both driver detach/reattach checks again (Logitech
6.1 seconds, Sonix 4.1 seconds), preserving the container ID and keeping the other
three sources advancing. The final Windows-client RTSP acquisition check measured
706 ms Logitech, 690 ms Sonix, 742 ms test bars and 818 ms Game of Life.

FFmpeg was compiled from resolved upstream master commit
`49a3b1f259e1c34033bf6cca4091a4cb07ebf90d`; its banner reports `8.0.git`.
The source is pinned when the workflow starts; upstream can advance while a build
and its physical checks run. The scheduled workflow resolves upstream again.
