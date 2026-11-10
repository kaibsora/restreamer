# USB camera hot-plug

On a Linux host with rootful Docker, systemd, udev and Python 3, the optional
host helper synchronizes V4L2 capture devices into the running container. It
does not require privileged mode, a Docker socket inside the container, or a
mount of the host's entire `/dev` directory. Docker permission is limited to
the V4L2 character-device major (81); metadata-only video nodes are excluded.

Run from the repository on the Docker host:

```sh
sudo install -m 0755 scripts/video-hotplug.py /usr/local/sbin/restreamer-video-hotplug
sudo install -m 0644 deploy/hotplug/restreamer-video-hotplug.service /etc/systemd/system/
sudo install -m 0644 deploy/hotplug/restreamer-video-hotplug.timer /etc/systemd/system/
sudo install -m 0644 deploy/hotplug/99-restreamer-video.rules /etc/udev/rules.d/
sudo systemctl daemon-reload
sudo udevadm control --reload-rules
docker compose -p deploy -f deploy/compose.yaml -f deploy/compose.hotplug.yaml up -d
sudo systemctl enable --now restreamer-video-hotplug.timer
sudo systemctl start restreamer-video-hotplug.service
```

Enabling this mode recreates the container once to grant its device-cgroup
permission. Subsequent camera changes do not require recreation. Do not combine
this override with explicit USB camera `devices` bind mounts: those retain the
old node after a disconnect. Keep the default GPU device mapping as usual.

Select a source under `/dev/v4l/by-id/` where possible, since numbered
`/dev/videoN` nodes can change after reconnection. Opening the source editor
refreshes the camera list. Enable source reconnection so an existing channel
recovers after its camera returns; recovery also depends on the configured
reconnect interval. A newly connected camera still needs a channel configured
in the UI. Cameras without unique serial numbers may have ambiguous aliases.

The udev rule triggers a short host service. A five-second timer also retries
after a container restart or missed event. State is kept under
`/run/restreamer-video-hotplug`; only previously managed video paths are removed.
The service targets the default container name `restreamer`. Change its
`--container` argument if using another name. This setup does not support
rootless Docker or Docker Desktop's USB forwarding.

Inspect synchronization without modifying the container:

```sh
sudo /usr/local/sbin/restreamer-video-hotplug --dry-run
sudo journalctl -u restreamer-video-hotplug.service -n 30
```

To stop automatic synchronization:

```sh
sudo systemctl disable --now restreamer-video-hotplug.timer
sudo rm /etc/udev/rules.d/99-restreamer-video.rules
sudo udevadm control --reload-rules
```

Recreate with just the base Compose file to remove the extra cgroup permission.
