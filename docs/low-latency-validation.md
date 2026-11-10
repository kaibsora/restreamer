# Validate RTSP and RTMP delay

The HLS UI preview and the LAN relay serve different purposes. A low-latency
publication must read a live RTMP/SRT feed, or receive packets directly from the
capture/encoder process. Reading HLS and republishing it as RTSP or RTMP preserves
the delay already accumulated in the HLS segments.

Keep source, encoder, receiver and server settings configurable:

- Select a format, size and frame rate actually advertised by the camera.
  USB, IP, compressed and raw sources can have different capture delays.
- Stream copy avoids encoding, but preserves the camera's GOP and B-frames.
  It cannot guarantee quick startup on a camera with a long keyframe interval.
- For transcoding, start with a 0.5–1 second GOP, no B-frames and a low-latency
  encoder mode. Choose a working software or hardware encoder for that host;
  do not select a GPU backend simply because the image contains its API.
- RTSP/TCP works through more network configurations. RTSP/UDP also needs
  working client RTP/RTCP ports, routing and NAT mappings; a failed UDP test is
  not a latency result. TCP retransmission can increase delay on lossy links.
- For FFmpeg RTMP readers, `-rtmp_live live -rtmp_buffer 0` avoids the default
  client buffer. Other players have their own caches and may behave differently.
- Avoid extra output mux buffering, and measure startup separately from ongoing
  frame age. Reader probing can itself delay or discard the initial keyframe.

See the [FFmpeg protocol options](https://ffmpeg.org/ffmpeg-protocols.html)
and the [deployment relay guide](../deploy/README.md#lan-rtsp-and-webrtc).

## Startup and sustained decoding

The existing acceptance helper supports RTSP(S), RTMP(S), HTTP(S) and V4L2 inputs.
Use URLs appropriate to the receiver's network, and choose explicit limits:

```sh
ACCEPT_VERIFY_HARDWARE=false \
ACCEPT_MAX_FIRST_FRAME_MS=2000 \
ACCEPT_SAMPLE_SECONDS=10 \
scripts/accept-deployment.sh \
  rtsp://RELAY_HOST:8554/CAMERA_PATH \
  rtmp://RTMP_HOST:1935/APPLICATION/STREAM
```

This measures first decoded frame and sustained decode count. It **does not**
measure ongoing frame age, optical sensor delay or camera-to-display latency.
Limits are acceptance criteria, not claims about every device or player.

## Measure ongoing software pipeline delay

`scripts/measure-video-delay.py` reads a timestamp strip burned into a temporary
test publication. The strip includes a magic byte and checksum, so ordinary or
corrupted video is rejected instead of producing a plausible-looking number.
No third-party Python packages are needed. The test requires a video at least
384 pixels wide and 8 pixels high. Do not use the marker on a permanent stream.

1. Stop the existing reader of the chosen camera before a direct USB capture.
2. Synchronize publisher and receiver clocks. For different hosts, provide the
   publisher-minus-receiver clock offset and a conservative uncertainty bound.
   The tool does not discover or synchronize those clocks automatically.
3. Generate the marker with `--print-filter`. The publisher must assign wall-clock
   input timestamps, preserve them through the marker, and normalize them **after**
   the marker with `setpts=PTS-STARTPTS`. Incorrect timestamp placement invalidates
   the measurement.
4. Start the reader after the publication is producing frames. Measure cold
   publisher startup separately if that is part of the requirement.
5. Stop the publisher/readers and restore the camera's original state afterward.

For example, this bounded software-encoder test publishes the same encoded video
to both protocols. Replace the source settings with advertised camera modes and
the destinations with configured test paths. The encoder is an explicit example,
not an automatically selected production default. A GPU encoder can replace it;
append its required pixel conversion/upload **after** the timestamp marker.

```sh
CAMERA_DEVICE=/dev/video0
CAMERA_FORMAT=mjpeg
CAMERA_SIZE=640x480
CAMERA_FPS=15
GOP_FRAMES=7
RTSP_DEST=rtsp://RELAY_HOST:8554/temporary-delay-test
RTMP_DEST=rtmp://RTMP_HOST:1935/temporary-delay-test
STAMP="$(python3 scripts/measure-video-delay.py --print-filter)"

timeout 45 ffmpeg -hide_banner -nostdin -copyts \
  -use_wallclock_as_timestamps 1 -f v4l2 \
  -input_format "$CAMERA_FORMAT" -video_size "$CAMERA_SIZE" \
  -framerate "$CAMERA_FPS" -i "$CAMERA_DEVICE" \
  -map 0:v:0 -an \
  -vf "$STAMP,setpts=PTS-STARTPTS,format=yuv420p" \
  -c:v libx264 -preset ultrafast -tune zerolatency \
  -b:v 2M -g "$GOP_FRAMES" -bf 0 -flags +global_header -f tee \
  "[f=rtsp:rtsp_transport=tcp:max_delay=0]$RTSP_DEST|[f=flv:flvflags=no_duration_filesize:flush_packets=1]$RTMP_DEST"
```

In another terminal or on a LAN receiver, run each reader while the publisher is
active. An offset of zero is valid only when the clocks share the same reference:

```sh
python3 scripts/measure-video-delay.py \
  --url rtsp://RELAY_HOST:8554/temporary-delay-test \
  --seconds 15 --clock-offset-ms 0 --clock-uncertainty-ms 0 \
  --max-age-ms 1000
```

Use the RTMP URL with the same command to test RTMP. `--rtsp-transport udp` is
available for a correctly routed UDP receiver. A decoder inside a container can
be selected without shell interpolation:

```sh
python3 scripts/measure-video-delay.py \
  --ffmpeg-prefix-json '["docker","exec","restreamer","timeout","45","ffmpeg"]' \
  --url rtmp://RTMP_HOST:1935/temporary-delay-test --seconds 15
```

The container/remote timeout is necessary: stopping a local launcher does not
guarantee that its remote decoder stops. The Python tool terminates its local
decoder on completion/failure, but cannot manage arbitrary remote launchers.

The JSON report includes startup time, marker count/errors, median/p95/max frame
age, first/last-half medians and clock uncertainty. Acceptance requires enough
frames over the requested window and p95 plus clock uncertainty below the chosen
bound. Run its regression checks with:

```sh
python3 scripts/test-measure-video-delay.py
```

The timestamp begins at FFmpeg's software input. Sensor exposure, camera firmware,
USB/driver queues before that timestamp, and final display scheduling are outside
the measurement. A real optical camera-to-display test still requires a visible
timing target and the intended viewer. Results for one mode, host and network do
not establish support or latency for every advertised camera mode or GPU.
