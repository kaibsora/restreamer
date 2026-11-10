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

The USB wizard starts with automatic format, size, and frame rate. Verification
prefers MJPEG when the camera supports it and saves the verified capture format;
otherwise it falls back to the camera's automatic mode. Format, resolution, and
frame rate can also be selected explicitly. For the tested Logitech C270 and
Sonix USB cameras, MJPEG at 640x480 and 15 FPS works on both devices. Raw capture
can use considerably more USB bandwidth and may negotiate a lower frame rate.

New USB sources omit input throttling and the obsolete input queue option.
For existing sources, Core checks the running FFmpeg binary's option scope and
omits input `-thread_queue_size` only when FFmpeg advertises it as output-only.
Stored source settings and output queue options are preserved.

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
