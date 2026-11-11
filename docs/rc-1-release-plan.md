# RC-1 release gate

**Published November 11, 2026:** [CQComber Restreamer RC-1](https://github.com/kaibsora/restreamer/releases/tag/rc-1).

- [x] Maintainer physical acceptance, including overnight stability, hot-plug,
  rotation, simultaneous sources and acceptable local delay.
- [x] CQComber Restreamer product branding and original SVG artwork.
- [x] Preserved upstream copyright/licenses, visible About attribution, NOTICE,
  modification overview and component/source inventory.
- [x] Complete installation/usage guide: GPU selection, CPU-only/NVIDIA overrides,
  USB controls and hot-plug, LAN relays/printer dashboards, public access and updates.
- [x] Explicit limitations: Intel validation; AMD/NVIDIA physically untested;
  audio outside the physical acceptance scope; HLS buffering and long native GOPs.
- [x] Bundled notices and patched FFmpeg source; public corresponding-source
  container pinned by digest, including exact Ubuntu package sources.
- [x] Full UI/Core/configuration gates, image smoke tests and published-image checks.
- [x] Release-container Intel VA-API/Quick Sync encode checks and live USB H.264
  browser playback; all 10 existing configurations and start/stop orders preserved.
- [x] Accepted digest promoted to `rc-1` and `latest` without rebuilding; anonymous
  access verified for both tags and the corresponding-source image.
- [x] `development` reserved for subsequent changes/testing; candidate builds cannot
  move `latest`, and promotion rejects development images or conflicting RC tags.

Application source: `1055016ed537ebcc5a22deb68dbb2dacd20ae8e8`.

Release image:
`ghcr.io/kaibsora/restreamer@sha256:798eee3f0bd960afb18fd73e9e64041a7dc1f06aeb1fad90d0c2f1f424649bc6`.

Corresponding source:
`ghcr.io/kaibsora/restreamer@sha256:b7bd27aba44397823c81652c535778e1739a9ccc0e5d637f804a34ae94e42043`.

[Successful build](https://github.com/kaibsora/restreamer/actions/runs/43055797347)
and [digest promotion](https://github.com/kaibsora/restreamer/actions/runs/43060716396).
The release's `rc-1-image.json` asset also records the FFmpeg runtime/source identity.

`main` holds accepted release code. Future changes and tests belong on `development`;
promote reviewed, physically accepted changes back to `main` before releasing.
`promote-release.yml` verifies the image revision, release branch, notices and source
availability, then tags the accepted digest. Ordinary/scheduled builds publish
unique `build-<run>-<attempt>` candidates. The deprecated `publish_latest` build input
must remain false. The fixed `rc-1` tag must not be overwritten by future releases.

The maintainer's overnight acceptance was on the functional candidate before final
branding/source packaging. The final release received the incremental verification
listed above; this record does not claim a second overnight run or new optical
latency measurements. Temporary verification viewers/containers were stopped.
