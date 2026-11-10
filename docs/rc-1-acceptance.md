# RC-1 physical acceptance checklist

Status: **maintainer testing pending**. Automated checks and the physical results
in [the validation report](physical-validation.md) do not mark these items as
accepted on the maintainer's behalf.

Use the immutable image pinned in `deploy/compose.yaml`. Hard-refresh the UI
after an image update. Keep the existing configuration/data volumes and a backup
before changing source settings. Stop test streams and close viewer tabs after
testing so they do not become permanent CPU consumers.

- [ ] Add each USB camera through the wizard. Confirm MJPEG or a supported capture
  mode, resolution and frame rate; verify visible motion rather than a still image.
- [ ] Try at least two driver-reported sizes and verify that frame-rate choices
  follow the selected format/size. On the attached C920, test native H.264 and
  **stream copy** at 720p or 1080p. The post-probe Profile list is the verified
  input track, not the list of every capture resolution; change capture modes
  using the preceding device-settings page.
- [ ] Open **Camera controls** in the wizard and advanced editor. Change brightness,
  read the result, then restore it. Test an automatic/manual exposure or white
  balance mode; verify dependent controls become available/inactive appropriately.
  Controls are hardware-specific. Zoom is not available on the two tested cameras.
- [ ] Choose an Intel encoder (VA-API and Quick Sync separately). Save and confirm
  playback. Test encoded **Rotate** at 90, 180 and 270 degrees and restore the desired
  orientation. Confirm the main player and an RTSP client show the same orientation.
  Rotation requires transcoding; it is unavailable with stream copy.
- [ ] Run both USB sources and two virtual sources together. Confirm all streams
  advance, inspect CPU/GPU load and check that existing channels remain usable.
- [ ] Test local RTSP and/or WebRTC delivery with visible real-world motion. Measure
  camera-to-display delay if sub-second latency is an acceptance criterion. HLS
  playback and RTSP connection-acquisition times do not establish optical latency.
- [ ] With the hot-plug override enabled, physically unplug/reconnect each camera.
  Verify the other streams continue and the affected stream recovers without
  recreating the container. Use stable device aliases and enable reconnection.
  Hardware controls may reset on reconnect and are not automatically reapplied.
- [ ] Recreate/restart Restreamer using the saved volumes. Confirm sources,
  orientation, publications and authentication survive. Verify recovery of cameras
  present at startup and cameras connected afterward.
- [ ] Test an external viewer through the reverse proxy, including video playback,
  TLS, correct published addresses and the required authentication/public-viewer
  boundaries. Public viewing may tolerate additional latency.
- [ ] Leave native H.264 HLS playback running for several playlist cycles and
  reopen it in a fresh browser tab. Check MPEG-TS and fMP4 HLS if both are used.
  Long camera GOPs must not cause cleanup to delete referenced segments,
  manifests or the persistent fMP4 initialization file. A successful FFmpeg
  decode alone does not prove browser playback.
- [ ] Check the printer dashboard's actual RTSP/MJPEG/player integration on the
  target printers; a working standalone RTSP player alone is insufficient.

Audio and physical AMD/NVIDIA GPU validation are outside this acceptance run.
AMD/NVIDIA support remains explicitly untested at publication unless new physical
evidence is recorded. Report failures with the exact image tag, capture mode,
encoder, device and relevant sanitized process report.

Once the maintainer accepts the tested core behavior, follow
[the RC-1 release plan](rc-1-release-plan.md) for branding, final documentation,
release promotion and the `development` branch transition.
