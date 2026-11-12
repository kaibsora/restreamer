# CQComber Restreamer architecture

## Repository layout

- `components/core`: the Go process manager and streaming services.
- `components/ui`: the React administration and player interface.
- `components/ffmpeg`: the patched FFmpeg build system.
- repository root: the final image, deployment assets, and release automation.

The components are imported with `git subtree --squash`. This keeps each upstream
project's license and provenance while allowing one checkout to produce the whole
application. Upstream updates can still be reviewed and imported independently.

## Image model

`Dockerfile` builds Core and UI from the source in this repository. The final stage
uses an architecture-specific FFmpeg image produced from
`components/ffmpeg/Dockerfile.ubuntu.hardware` (AMD64) or
`components/ffmpeg/Dockerfile.ubuntu.arm64` (ARM64).

The AMD64 hardware image intentionally contains all three Linux GPU stacks:

- NVIDIA NVENC/NVDEC and CUDA through the NVIDIA container runtime;
- Intel VA-API and oneVPL/Quick Sync through `/dev/dri`;
- AMD VA-API and Vulkan Video through Mesa and `/dev/dri`.

Compiled support is not the same as runtime support. The host must expose the GPU,
install a compatible kernel driver, and—only for NVIDIA—install NVIDIA Container
Toolkit. Encoder availability must be detected at runtime rather than inferred from
the image tag.

## Latency planes

LAN viewing and public web viewing have different constraints and must not share one
buffering profile:

1. LAN: camera passthrough whenever possible, RTSP over UDP/TCP or WebRTC, short GOP,
   no B-frames, and bounded probe/analyze queues. Target glass-to-glass latency is
   below one second.
2. Public web: HLS is allowed to buffer and prioritize resilience through the reverse
   proxy. This path can transcode independently from the LAN feed.

CI exercises four concurrent synthetic H.264 publishers and readers on AMD64,
and two on the constrained ARM64 runner. Each publisher
uses all-intra frames to isolate relay and read-startup overhead from a camera's GOP,
and every first decoded RTSP frame must arrive in less than one second. The same test
also verifies that every named path exposes a WebRTC endpoint. Physical
glass-to-glass latency remains a deployment acceptance test because camera capture,
hardware encoding, LAN conditions, and browser rendering are outside the container.

The existing Core accepts RTSP inputs and can publish *to* an RTSP server, but it is
not itself a general RTSP origin. MediaMTX therefore provides the LAN RTSP/WebRTC
origin as a separate process. Restreamer publishes named paths to it; Mainsail,
Fluidd, VLC, and other compatible clients can consume those paths without involving
the buffered public HLS delivery plane.

## Release policy

The unified workflow resolves FFmpeg's current `master` commit on scheduled and
manual builds, builds the patched hardware image first, then pins the final
Restreamer build to the resulting immutable digest. Each source image is tagged with
the full Git commit and input hash (`ffmpeg-hardware-ARCH-git-SHA-INPUTS`) inside the same GHCR package as the
unified image. Each build records exact binary and corresponding-source digests;
source-only tags may be rebuilt, so the digest is the reproducible identity.
No second package permission grant is required. `stable` and exact numbered releases remain
available for reproduction and rollback. Patch drift is expected to fail loudly in
CI so it can be rebased and reviewed instead of silently publishing an unpatched
binary.

The `development` branch produces candidates. The accepted branch is `main`.
Neither scheduled nor ordinary manual builds can publish `latest`; a separate
digest-based promotion workflow on `main` publishes an immutable stable version
after acceptance, with major/minor/`latest` aliases.
See [component notices and source distribution](../THIRD_PARTY.md).

## Native ARM64 images

The native matrix uses `restreamer-linux` for AMD64 and `restreamer-arm64` for
ARM64. The ARM recipe is `components/ffmpeg/Dockerfile.ubuntu.arm64`, with V4L2
M2M/DRM and software codecs instead of desktop GPU libraries. Each platform
passes its own acceptance job before the combined OCI index is created. The
promotion workflow validates both architectures natively before moving latest.
See [Pi deployment and limitations](raspberry-pi.md).
