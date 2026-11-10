# Physical video validation

Verified image: `ghcr.io/kaibsora/restreamer:sha-c545e64`.

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

## Hardware findings still being addressed

- VA-API H.264 passed on the deployed image.
- The UHD 630 does not expose Vulkan Video encode-queue support in this runtime.
- Quick Sync failed on the deployed image. A disposable diagnostic container
  successfully encoded 30 frames after adding `libmfx1` and `libmfx-gen1.2`, using
  system-memory NV12 input, `-low_power 1`, an explicit bitrate, and async depth 1.
  The runtime packages and compatible encoder mapping still need integration.
- The optional [USB hot-plug helper](usb-hotplug.md) was tested with both cameras
  using stable `/dev/v4l/by-id` sources. A targeted `uvcvideo` driver detach removed
  the Logitech capture node and alias from the running container. The Sonix and
  both virtual streams continued advancing. After driver reattachment, all four
  streams advanced again within 6.1 seconds, with the same container ID. This
  tests software detach/reattach, not a physical cable unplug.

Camera images and host credentials are deliberately excluded from this repository.
