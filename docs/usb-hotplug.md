# USB camera hot-plug

USB discovery and device synchronization run inside Core. No host helper,
custom systemd unit, Python runtime, Docker socket, or privileged container is
needed. This mode requires Linux with rootful Docker and Core running as root.

From the repository on the Docker host:

```sh
docker compose -p deploy -f deploy/compose.yaml -f deploy/compose.hotplug.yaml up -d
```

The override mounts the host's `/dev` read-only at `/host/dev`, enables the
built-in watcher, grants V4L2 read/write device access (major 81), and drops the
`MKNOD` capability. The watcher maintains links to capture devices and their stable
`/dev/v4l/by-id/` aliases into the container's own `/dev`. Metadata-only nodes
are excluded from these managed links using the V4L2 capture-capability query. No character-device
creation is needed: opening a managed link resolves the current host device.

The host device directory is visible inside the container. The read-only mount
protects its filesystem entries; device I/O remains governed by device-cgroup
rules and device permissions. This is broader host-device visibility than static
individual camera mappings. The container does not receive unrestricted device
access or permission to modify the host's device directory.

Enabling this mode requires one container recreation. Later camera changes do
not. Do not combine this override with explicit USB camera `devices` bind mounts:
those retain old nodes after a disconnect. Keep the GPU mapping as usual.

Initial camera synchronization completes before Core probes devices or starts
channels. Core then checks for changes every second. Fast reconnects that reuse
a device number are detected by host inode identity. Managed state is saved
inside the container at `/run/restreamer-video-hotplug.json`, allowing stale links
to be removed and missing links to be restored after restart. Only managed camera
links and matching managed aliases are removed; unrelated files are preserved.

Use **Custom ...** in the UI's video-device selector to enter a path under
`/dev/v4l/by-id/`, since numbered `/dev/videoN` nodes can change after reconnection.
Opening the source editor refreshes the camera list; use **Refresh** if it was
already open when the camera was connected. Enable source reconnection so a
channel recovers when its camera returns. Recovery also depends on the channel's
reconnect interval. New cameras still need channels configured in the UI.
Cameras without unique serial numbers can have ambiguous aliases.

## Adding a camera in the UI

The USB wizard starts with automatic format, size, and frame rate. Core queries
the selected camera's advertised V4L2 formats, resolutions and frame intervals.
Choose **Capture format**, then **Capture resolution**, then **Capture frame rate
(FPS)** before verifying the source. This page configures the camera input;
output encoder choices appear after verification.
The lists are device-specific: changing format resets size and frame rate, and
changing size resets frame rate. The API preserves rational rates such as
`30000/1001` and `15/2`, rather than rounding them to integers.

Automatic capture prefers advertised camera H.264, then MJPEG. The wizard verifies
the choice and saves the resolved capture format; if compressed verification
fails it can fall back to native automatic capture. Automatic size uses the
camera's negotiated default, not its largest resolution. For the tested Logitech C270 and
Sonix USB cameras, MJPEG at 640x480 and 15 FPS works on both devices. Raw capture
can use considerably more USB bandwidth and may negotiate a lower frame rate.

The **Detected video track** list after verification shows detected input tracks,
not every camera capture mode. It normally has one entry for a USB camera. Use
**Change camera format, resolution or frame rate** to return to the capture
choices without saving the draft. Camera H.264 can use **stream copy** to avoid
re-encoding; the wizard exposes that choice explicitly. Disable stream copy and
choose an encoder if rotation or other video filters are needed.

The physical C920 reports 17 H.264 sizes and 17 MJPEG sizes up to 1920x1080,
plus 19 raw YUYV sizes up to 2304x1536. Native H.264 stream copy and decoding
passed at 640x480, 1280x720 and 1920x1080 at 15 FPS. These are results for this
attached camera/driver, not a promise that every camera model exposes the same
hardware codec through V4L2.

`GET /api/v3/camera/modes?device=/dev/video0` returns format-specific sizes and
frame rates without starting capture or changing the active mode. The backend
uses Linux's [format](https://docs.kernel.org/userspace-api/media/v4l/vidioc-enum-fmt.html),
[size](https://docs.kernel.org/userspace-api/media/v4l/vidioc-enum-framesizes.html), and
[frame-interval](https://docs.kernel.org/userspace-api/media/v4l/vidioc-enum-frameintervals.html)
enumeration APIs. Continuous/stepwise ranges are displayed as ranges with manual
input; unlisted combinations still need verification. If enumeration fails or
is unavailable on an older backend, manual capture settings remain accessible.
Formats without a supported FFmpeg input mapping are shown disabled.

New USB sources omit input throttling and the obsolete input queue option.
For existing sources, Core checks the running FFmpeg binary's option scope and
omits input `-thread_queue_size` only when FFmpeg advertises it as output-only.
Stored source settings and output queue options are preserved.

## Camera controls and rotation

In either USB source editor, expand **Camera controls** to read the selected
camera's V4L2 controls. The panel queries the device on demand, without polling
or running another service. Available controls depend on the camera: brightness,
contrast, white balance, exposure, focus or zoom appear only if the driver
advertises them. Device-provided names and menu entries are shown as reported
by the kernel; the surrounding UI is localized.

Adjust a value and click its **Apply** button. Values are validated against the
driver's range, step, and available menu indices. Changes immediately affect
the physical camera and every application using it; closing or cancelling the
source editor does not undo a hardware change. Automatic modes may make manual
controls inactive. The panel refreshes all values and availability after each
write. Use **Refresh controls** after another application changes the camera or
after reconnecting it. These controls do not restart the stream.

Camera firmware may reset controls after a restart or USB reconnection. This
version does not persist and reapply them. Integer, boolean, menu, integer-menu,
bitmask and button controls are supported; string, 64-bit and compound/payload
controls are displayed as unsupported and cannot be edited. No host helper,
`v4l2-ctl`, privileged mode or extra device permissions are needed beyond capture
access. API access uses the ordinary authenticated Core API:

- `GET /api/v3/camera/controls?device=/dev/video0`
- `PUT /api/v3/camera/controls` with JSON `{"device":"/dev/video0","id":9963776,"value":128}`

Stable `/dev/v4l/by-id/` and `/dev/v4l/by-path/` aliases are also accepted. Only
V4L2 capture character devices (major 81) can be opened. The ordinary Core
authentication configuration applies; do not expose an unauthenticated admin API.

For image orientation, use **Rotate** in the advanced source editor's video
filter settings after selecting a transcoding encoder. The choices are no
rotation, 90, 180 and 270 degrees clockwise. Rotation changes the encoded frames,
so the browser player and all publications receive the same orientation. It
works before the Intel VA-API/QSV encoder conversion/upload, and remains visible
when hardware encoding is selected. Save the source settings to apply rotation.
Stream-copy mode cannot rotate frames. NVIDIA/AMD hardware paths remain untested.

### Native H.264 keyframe intervals and HLS retention

Stream copy preserves the camera's keyframe interval. The tested C920 produced
roughly 20-second segments even with a two-second HLS target, because a new
segment normally starts at a keyframe. HLS startup and playback latency can
therefore be much higher than the configured target. Transcoding through an
Intel encoder with a short GOP gives control over that interval; stream copy
cannot shorten it. Use the local relay protocols for low-latency viewing and
measure the actual camera-to-display delay on the intended clients.

Cleanup retains the configured playlist window plus six spare segment files,
rather than expiring media based on the requested segment duration. Active
playlists and fMP4 initialization files have no age expiry; deleting the channel
still purges its files. An unbounded playlist has no finite Core file-count cap.
This prevents long camera GOPs from causing 404s for media still referenced by
the playlist. Stopped channels retain their final window until channel deletion
or other storage management. HTTP uploads do not use filesystem rename flags;
atomic temporary-file replacement is used only for disk HLS output.

The UI player retries network failures every five seconds while it is open.
This lets a camera's first playlist become available after a long initial GOP
without requiring a page refresh. Closing the player cancels pending retries.
Decode errors are not retried as network failures. These retries do not shorten
the camera's GOP or remove HLS latency.

Inspect synchronization through the ordinary container logs:

```sh
docker logs restreamer 2>&1 | grep VideoHotplug
```

This mode does not support rootless Docker or Docker Desktop USB forwarding.
Without the override, the watcher is disabled and fixed device mappings continue
to work.

## Migration from the previous host helper

Do not run both synchronizers against the same container. If the old host helper
was installed, disable it before bringing up the integrated mode:

```sh
sudo systemctl disable --now restreamer-video-hotplug.timer
sudo rm -f /etc/udev/rules.d/99-restreamer-video.rules
sudo udevadm control --reload-rules
sudo systemctl stop restreamer-video-hotplug.service
docker compose -p deploy -f deploy/compose.yaml -f deploy/compose.hotplug.yaml up -d --force-recreate restreamer
```

After verifying camera recovery, remove the obsolete helper files:

```sh
sudo rm -f /etc/systemd/system/restreamer-video-hotplug.service /etc/systemd/system/restreamer-video-hotplug.timer
sudo rm -f /usr/local/sbin/restreamer-video-hotplug
sudo systemctl daemon-reload
```
