# Physical video validation

Published release baseline: `ghcr.io/kaibsora/restreamer:1.0.0`.

Published image digest:
`sha256:867fef634c8c96f5630ae3c3480ffcbfa89644d0b257dc8c7ac0de9c25a9ffc2`.

The initial four-stream baseline below used `sha-c545e64`. Updated-image results
are recorded at the end of this document.

For repeatable protocol measurements and their limits, see
[RTSP/RTMP delay validation](low-latency-validation.md).

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

## Integrated USB hot-plug verification

Image `sha-cd54367` moves discovery and synchronization into Core. The test host's
previous custom systemd timer/service and udev rule were disabled before testing.
Both cameras were accessed through managed links into the read-only `/host/dev`
mount, with `CAP_MKNOD` dropped and privileged mode disabled. Camera enumeration
retained both friendly names and excluded metadata-only nodes.

All four sources resumed after container restart, and all eight HLS/RTSP outputs
decoded concurrently. First-frame RTSP acquisition in this run measured:

| Source | First decoded frame |
| --- | ---: |
| Logitech USB | 806 ms |
| Sonix USB | 783 ms |
| Virtual test bars | 654 ms |
| Virtual Game of Life | 932 ms |

Targeted driver detach/reattach checks passed for both cameras. Core removed the
stale private links and restored them on reconnection. Logitech recovered within
6.3 seconds and Sonix within 4.4 seconds; each test preserved the container ID
and kept the other three streams advancing. These are software driver detach
tests, not physical cable-unplug tests. Optical latency remains unmeasured.

The refreshed FFmpeg runtime also passed 50-frame H.264 QSV, HEVC QSV and HEVC
VA-API encode/decode checks with MKNOD dropped. A temporary Core-managed QSV
Game of Life stream decoded 75 frames over five seconds through both HLS and
RTSP while the baseline sources ran; the temporary process was then removed.

For reproducible feature validation this image uses the master snapshot
`e79f6cd023e57847d898358f9e80a65200d94d44` built and verified during this work.
Normal push and scheduled builds continue resolving current upstream master.

After the obsolete host helper binary, custom udev rule, timer and service files
were uninstalled, another Logitech driver detach/reattach recovered within 6.4
seconds. The container remained healthy and unprivileged; `/host/dev` was mounted
read-only and no Docker socket was mounted.

## USB source wizard verification

Image `sha-ceeef31` fixes camera verification against the current FFmpeg runtime.
The old wizard supplied input `-thread_queue_size`, which this binary now marks
output-only, and forced NV12 at 1280x720/25 FPS. Core now detects the option's
scope from the running binary and normalizes legacy input commands. The new
wizard exposes capture controls and prefers supported MJPEG in automatic mode.

Both the Logitech and Sonix cameras passed Core API probes for three cases:
legacy input queue options, automatic MJPEG capture, and explicit MJPEG at
640x480/15 FPS. Automatic MJPEG negotiated 640x480/30 FPS on both devices.
The actual browser wizard also passed for each camera with all capture settings
initially automatic, advancing to **The video source is compatible** and the
640x480 MJPEG profile/encoder selection page. The temporary wizard channel was
never saved. This verifies source setup, not a new end-to-end latency measurement.

The build passed all 276 UI tests, the production UI build and dependency audit,
the full Core tests and vet, configuration checks, container smoke tests, and
published-image digest verification. The deployed digest matched GHCR. After
verification, all four existing user processes remained, with no diagnostic
processes left. Test browser tabs, local test containers/cache images, and remote
diagnostic scripts were removed.

## Camera controls, translations and rotation

The `sha-d57a8c6` candidate includes refreshed catalogs for all 15 languages,
restoring 28 previously unextracted messages. Builds now extract/compile catalogs
automatically and verify compiled message coverage, with English fallback where
translations are unavailable. A deliberately removed compiled label was rejected
by this guard. Existing translated text was preserved.

The native V4L2 API reported 12 controls on the Logitech and 14 on the Sonix.
On each camera, a one-step brightness change was read back and the original
value restored. This passed both through the native backend and through the
authenticated API on the final deployed image. Unauthenticated reads returned
401; non-camera device paths returned 400. Driver menus with missing indices,
ranges/steps, inactive controls and path restrictions have regression coverage.
Neither tested camera advertises zoom. Hardware control persistence across
reconnection/restart is not implemented; see the [control guide](usb-hotplug.md).

Browser checks verified actual controls in the USB wizard and advanced editor,
including readable automatic-mode labels and disabled manual controls while
automatic modes are active. The Quick Sync low-power field now displays
**Enabled**, and the advanced filter editor exposes **Rotate** with None, 90,
180 and 270 degrees while Quick Sync is selected. A 90-degree selection was
verified in an unsaved draft; existing camera configurations were not modified.

Bounded 20-frame Intel H.264 VA-API and Quick Sync tests rotated a 640x480 source
90 degrees and successfully decoded the resulting 480x640 video. This verifies
encoding and dimensions, not a new optical-latency measurement. NVIDIA/AMD
rotation and hardware encoding remain physically untested.

The browser check also caught FFmpeg's changed filter-capability output: current
rows use two flag columns instead of three. Core now accepts both layouts.
The deployed API advertises 518 filters, including transpose, hflip, vflip,
scale and drawtext. Container smoke tests now require these API capabilities,
so successful FFmpeg encoding alone cannot hide a broken UI filter list.

All 301 UI tests, production build/catalog checks, full Core tests and vet,
configuration checks, expanded container smoke tests and published digest
verification passed. The deployed digest matched GHCR. All eight existing
user processes remained; no temporary streams or test viewers remained.
Local test containers and remote diagnostic files were removed.

This candidate did **not** update `latest`. Maintainer physical acceptance,
RC-1 promotion, final branding/documentation and the development-branch cutover
remain pending under the [release plan](rc-1-release-plan.md).

## Camera capture mode discovery and native H.264

Image `sha-606fb57` enumerates V4L2 capture formats, frame sizes and frame intervals.
It offers those choices before probing, with dependent size/frame-rate selections
and an explicit H.264 stream-copy option. The post-probe Profile menu now describes
verified tracks instead of implying that it lists every camera resolution.

Both the native backend and the deployed authenticated API returned:

| Camera | Format | Advertised sizes | Largest size |
| --- | --- | ---: | --- |
| Logitech 046d:0825 | YUYV / MJPEG | 19 / 19 | 1280x960 |
| Sonix USB camera | MJPEG / YUYV | 5 / 5 | 1920x1080 |
| Logitech C920 | YUYV | 19 | 2304x1536 |
| Logitech C920 | H.264 / MJPEG | 17 / 17 | 1920x1080 |

The C920 advertises H.264 frame rates of 30, 24, 20, 15, 10, 15/2 and 5 FPS at
1920x1080. Fifteen-frame physical samples at 15 FPS passed native H.264 stream
copy and decode at 640x480, 1280x720 and 1920x1080. Sample files were deleted.
This confirms capture/decoding, not sustained throughput at every advertised
rate or camera-to-display latency. Firmware/driver capability lists can differ
between cameras sold under the same model name.

The deployed browser wizard displayed all 17 H.264 sizes, accepted 1920x1080 at
15 FPS, verified a 1920x1080 H.264 track and selected stream copy by default.
That temporary channel was never saved. API checks confirmed authentication,
non-camera path rejection and format-specific rate lists. All eight existing
user processes remained after deployment and UI verification.

All 305 UI tests, production build/catalog checks, full Core tests and vet,
configuration checks, container smoke tests and published digest verification
passed. Unit tests cover current ioctl layouts through synthetic enumeration,
stepwise ranges, exact rational frame rates, dependent UI selections and failed
H.264 fallback. The deployed digest matched GHCR; test containers, viewers and
remote diagnostic files were removed. `latest` was not promoted.

## Native H.264 HLS retention and browser startup

The C920's saved 1920x1080 H.264 stream-copy channel produced approximately
20-second segments. The previous cleanup policy expired files after 24 seconds,
despite a six-segment playlist window. Older segments still listed in the
playlist returned 404, and the master playlist could also expire between
updates. Decoding a fresh segment with FFmpeg succeeded while the browser
remained stuck, so that check alone was insufficient.

Image `sha-8c214c4` retains segments by count and removes playlist age expiry.
It also stops requesting filesystem temporary-file renames for HTTP HLS output.
The existing C920 channel's saved cleanup rules and HTTP flags were migrated
without changing capture, encoding or other channels. On the physical host,
all six referenced segments returned HTTP 200, including segments older than
the former expiry limit. After a browser refresh, the actual player displayed
1920x1080 video with readyState 4 and advancing playback time. Ten existing
process configurations were preserved.

A cold-start browser test found a separate player issue: an initial missing
playlist could leave playback stuck after the camera began publishing valid
media. A timed retry replaces the previous single immediate reload. Unit tests
cover repeated network failures, deduplication, successful metadata, disposal,
decode-error exclusion and preservation of a manually paused player. Recovery
keeps an original source snapshot and passes a fresh copy on every retry;
Video.js clearing its error during loadstart does not cancel a pending retry.
The UI test suite now contains 318 passing tests.

The revised UI was staged temporarily on the physical test container before
publishing its image. A fresh browser was opened before starting the stopped
C920 after a container restart. Two initial HLS network failures were followed
by automatic 1920x1080 playback, without a page refresh. Playback time advanced
from 34.7 to 67.0 seconds with readyState 4. All five then-listed segments
returned HTTP 200, including segments older than 24 seconds. The viewer was
closed and the camera restored to its original stopped order.

The published `sha-dd1d09f` image repeated that cold-start check after recreation
from GHCR, with no temporary UI overlay. Three initial playlist network errors
recovered automatically; 1920x1080 playback time advanced from 22.0 to 81.1
seconds with readyState 4. All four then-listed segments returned HTTP 200,
including media older than the former expiry window. The running image's source
revision and registry digest matched the published candidate. All ten user
process configurations remained. The viewer and diagnostic files were removed,
the C920's original stopped order was restored, and no test containers remained.

The final workflow passed all 318 UI tests, production build/catalog checks,
Core tests/vet, configuration validation, container smoke tests, image size
checks and published-digest verification. `latest` was not promoted.

These changes do not shorten the camera's native keyframe interval. HLS startup
and latency remain affected by its long GOP. The initial timestamp warnings in
the camera's FFmpeg log were not evidence of the missing-file/player problems
being resolved, and are not claimed as fixed by this repair.

## RTSP and RTMP camera delivery, November 10, 2026

The deployed `sha-dd1d09f` runtime was tested with all three attached cameras.
The temporary capture profiles used driver-advertised MJPEG at 640x480/15 FPS,
Intel VA-API H.264 at 2 Mbit/s, a seven-frame GOP, no B-frames and async depth 1.
Each encoder published the same packets directly to RTSP and RTMP through tee;
neither path read HLS. These were test profiles, not modifications to the saved
user profiles or requirements imposed on other cameras/GPUs.

RTSP used the deployed MediaMTX service. Core's RTMP server was disabled in the
saved configuration, so a temporary MediaMTX RTMP receiver was used instead of
enabling/reconfiguring it. The RTMP result validates publishing to that receiver,
not the disabled Core RTMP-server feature or every third-party RTMP server.

The camera frames carried a binary software-input timestamp with a magic byte
and checksum. A decoder on the other LAN endpoint measured the timestamp after
decoding. Publisher/receiver clock offset was calibrated over SSH; the concurrent
run's conservative clock uncertainty was ±88 ms. This measures the pipeline from
FFmpeg's software input timestamp through encoding, muxing, server, network and
decoding. Sensor exposure, firmware/USB/driver buffering before that timestamp,
and display scheduling are excluded. It is **not optical camera-to-display
latency**.

All three camera publishers and all six RTSP/TCP and RTMP decoders ran concurrently
for 15 seconds. Each reader decoded 226 valid marked frames, with no checksum
errors. First/last-half medians differed by at most 1 ms; no accumulating delay
was observed during this bounded run.

| Camera | RTSP/TCP median / p95 | RTMP median / p95 | First frame, RTSP / RTMP |
| --- | ---: | ---: | ---: |
| Sonix USB | 228 / 240 ms | 161 / 171 ms | 766 / 1157 ms |
| Logitech 046d:0825 | 225 / 238 ms | 160 / 169 ms | 922 / 844 ms |
| Logitech C920, transcoded | 228 / 240 ms | 161 / 171 ms | 891 / 828 ms |

The largest p95 plus clock uncertainty was approximately 328 ms for RTSP and
260 ms for RTMP, below one second for this tested pipeline. Startup includes the
reader launch and protocol negotiation; the table shows that ongoing sub-second
delivery does not guarantee a first frame below one second in every trial.
Separate ten-second single-camera trials produced similar stable frame ages.
The reusable acceptance helper also passed RTSP and RTMP startup/sustained decoding
against real publications (294/1156 ms first-frame acquisition, then at least
10 decoded FPS over three seconds, using an explicit two-second startup limit).

The saved C920 native-H.264 capture input was also tested without transcoding.
Two RTSP first-frame trials took 17.8 and 7.6 seconds. RTMP took 27.5 seconds in
one trial; another reader timed out at 30 seconds. Its approximately 20-second
GOP and the receiver's probing/keyframe behavior therefore prevent a sub-second
startup claim for this passthrough configuration. Ongoing native-passthrough frame
age was not measured with the burn-in marker, since adding that marker requires
decoding/encoding. Use a shorter camera GOP where supported, or a short-GOP encoder
when fast acquisition is required; do not silently force a camera-specific mode.

RTSP/UDP did not deliver valid frames to the containerized LAN receiver in this
test network, even with explicit client port mappings. No LAN UDP latency pass
is claimed; routing/NAT/client port behavior needs a suitable receiver setup.
RTSP/TCP and RTMP are the validated LAN paths above.

All temporary Core processes, the RTMP receiver, LAN decoder container and
diagnostic readers were removed. Fingerprints of all ten saved process configs
and their original start/stop orders matched after every run. The HLS UI player,
saved source/encoder settings and published image tag were unchanged. NVIDIA/AMD
hardware and other camera modes still require their own physical validation.

## Clearer camera wizard wording

Image `sha-e64d3be` renames the post-probe **Profile** field to **Detected video
track**. The capture step labels format, resolution and frame rate explicitly,
explains the selection order and clarifies that automatic resolution uses a
camera default rather than its maximum. A separate button on the detected-track
page returns directly to the camera capture choices.

On the deployed image, an unsaved draft selected the stopped Logitech camera's
MJPEG 1280x720/30 FPS mode. Verification displayed that 1280x720 MJPEG track under
the new label. The return button preserved all three capture selections. No
channel was saved; the running C920 was not used for this probe. All eight
current process configurations and their original start/stop orders matched the
pre-deployment baseline afterward. The running image revision/digest matched
GHCR. All 318 UI tests, 15 catalog coverage checks, production build, Core tests,
configuration checks and image smoke/publication checks passed. `latest` was not
promoted.

## November 11 RC-1 packaging and deployment verification

[RC-1](https://github.com/kaibsora/restreamer/releases/tag/rc-1) uses application
revision `1055016ed537ebcc5a22deb68dbb2dacd20ae8e8` and the FFmpeg source revision
`e79f6cd023e57847d898358f9e80a65200d94d44` used in the accepted functional candidate.
The release adds CQComber branding, source/notices distribution and release guards.

The final container passed active Intel VA-API and Quick Sync encode checks with
the deployment's real DRM mapping. The C920's existing native H.264 1280x720 stream
played in the browser after recreation, with the UI reporting 15 FPS. The
MediaMTX publication remained enabled. All 10 saved process configurations and
original start/stop orders matched the immediate pre-deployment snapshot, including
the intentionally stopped second USB camera. A private configuration backup was
retained on the test host. Browser playback and About attribution screenshots are
retained in private verification artifacts.

Full UI/Core/configuration checks, source-archive/notices validation and the
integration smoke stack passed in the release build. The accepted digest was then
promoted without rebuilding. Anonymous manifest access was checked for `rc-1`,
`latest` and the exact corresponding-source image. The release asset
`rc-1-image.json` records all immutable identities.

This was an incremental packaging/release check after the maintainer's overnight
functional acceptance. No new optical delay measurement, AMD/NVIDIA physical test
or audio acceptance is claimed. Verification viewers, preview containers and
hardware-test containers/scripts were stopped or removed; user channel orders were
preserved.

## Live dashboard controls and additional Intel checks, November 12, 2026

The new dashboard UI at development commit
`fb117f88af529475c01c03f38e64e69b6e4e1e7f` was built locally and served through a
loopback-only preview proxy to the running 1.0.0 backend identified above. This
kept the stable application's files and saved source settings unchanged. The
[native development candidate workflow](https://github.com/kaibsora/restreamer/actions/runs/43279430890)
qualifies the separately built development image; the preview results below do
not themselves claim a deployment of that image.

Two connected physical USB cameras (C920 and a USB 2.0 camera) were already
streaming. All seven saved process configurations and their start/stop orders
were fingerprinted before testing and checked afterward.

- **Live controls:** brightness changed by one driver-reported step on each
  camera, read back, and restored. Capture PIDs remained identical; the two
  streams advanced by 30 and 62 frames during their respective checks. In Chrome,
  the new player-page panel applied brightness from 0 to 1 and back to 0 with the
  live preview running. Driver-dependent inactive controls stayed disabled.
  Unauthenticated writes returned 401; an authenticated `/dev/null` write was
  rejected with 400. No stream edit/save, stop/start or camera-mode change was
  needed. The unit/integration checks also verified player DOM continuity and
  that a network channel does not expose unrelated local USB controls.
- **Hardware filter composition:** a live camera's HLS output was decoded, scaled
  to 640x360, overlaid with a PNG logo and UTF-8 text, and encoded into 45-frame
  H.264 samples with Intel VA-API and Quick Sync separately. Both outputs decoded
  all 45 frames. Encoder tags identified the requested hardware backend. Decoded
  screenshots visibly contained the logo and `CQComber — café Ω`. This is a
  finite FFmpeg filter/backend check, not a new test of a UI-authored watermark
  publication, optical latency or low-latency HLS forwarding.
- **Concurrent capture/encode:** both saved USB cameras continued advancing
  while additional test-bars and Game-of-Life inputs each ran a 45-second
  640x480/15 FPS VA-API encode. Five observations eight seconds apart found both
  physical captures and both virtual encoders active. The virtual encoders
  completed normally. This is a bounded four-source regression check, not a new
  overnight soak or multi-IP-camera test.
- **RTSP input recovery:** an isolated synthetic short-GOP RTSP/TCP publisher and
  temporary Core stream-copy reader produced frames, the publisher was stopped,
  and a replacement publisher was started. The reader resumed advancing frames
  without recreating Restreamer. The recovery observation was 3.609 seconds
  after the replacement publisher's two-second warmup; this is not ongoing frame
  age or an end-to-end latency measurement. Reader reconnect delay was one
  second, input timeout three seconds and stale timeout five seconds. This
  validates controlled source-loss recovery, not real IP-camera firmware,
  authentication or reboot behavior.
- **Resilient browser relay:** an unused configured resilient slot was viewed in
  Chrome using MediaMTX's built-in WebRTC player. The offline slate changed to a
  finite physical-camera readback publication encoded with Intel VA-API, then
  returned to the slate when that publisher exited. There were no page reloads;
  video readiness stayed at 4 and playback time advanced from approximately
  27.731 to 62.343 to 89.984 seconds. The decoded dimensions changed from the
  1920x1080 slate to 640x360 video and back. This is browser relay evidence;
  it does not substitute for the pending real Mainsail/Fluidd/Frigate tests.

Temporary encoders, the synthetic RTSP publisher/reader, the finite resilient
publisher and the local UI preview were stopped/removed; agent-created viewers
were closed. Temporary remote sample files were removed. Camera brightness was
restored, and saved process configurations/orders were preserved. No new Pi
application test deployment was created.

AMD/NVIDIA/AV1 and Pi 4 hardware encoding, two independent physical IP cameras,
RTSP/UDP on a suitable routed receiver, optical delay, the new overnight IP soak,
UI-authored hardware watermark publication, real printer/Frigate client details
and WAN load remain open in [tracking issue #2](https://github.com/kaibsora/restreamer/issues/2).
Audio remains outside this video-only run.
