# RC-2 native multi-platform acceptance

RC-2 was published November 11, 2026, as `ghcr.io/kaibsora/restreamer:rc-2`
and `:latest`. Both reference the same accepted OCI index, with native
`linux/amd64` and `linux/arm64` images and their attestations:

```text
sha256:efbb682fcae1fc443c139b11e727dccd6d43c7f1bae0113d5622d9ea96da6a8b
```

Application source: `c97bee038f36f93794f15df4c083f6c16722cd7e` on `main`.
The commit-seeded footer name is `calm-forest-4894` on both architectures.
Both images use FFmpeg source `a337e8ddaa095a3cf82564272ec518cced09641e`.
The [release's `rc-2-image.json` asset](https://github.com/kaibsora/restreamer/releases/tag/rc-2)
records each platform's exact application/runtime/source digests.

## Validation

The [native build](https://github.com/kaibsora/restreamer/actions/runs/43108341982)
passed UI, Core and configuration gates, then built and tested both architectures
on custom ARC runners. AMD64 passed four concurrent synthetic camera/relay
streams; ARM64 passed two on a Raspberry Pi 5. Published-image verification
checked architecture, application identity, FFmpeg features, HEVC HLS and source
packaging. The combined index includes both platforms and their attestations.

The exact accepted digest was deployed to the physical AMD64 test host using its
existing configuration/data volumes. All 10 process configurations and start/stop
orders were preserved. Intel UHD Graphics 630 VA-API and Quick Sync each encoded
a test frame. The C920 native H.264 stream advanced at approximately 15 FPS;
current HLS segments decoded successfully and live browser playback was visible.
The footer showed the expected commit-seeded name. Finite encode/decode tools
exited and the verification browser tab was closed.

[Promotion](https://github.com/kaibsora/restreamer/actions/runs/43112900635)
revalidated both native images and tagged the accepted index without rebuilding.
Anonymous registry access was checked for both release tags and the per-platform
corresponding-source images. The immutable `rc-1` digest remains
`sha256:798eee3f0bd960afb18fd73e9e64041a7dc1f06aeb1fad90d0c2f1f424649bc6`.

This is incremental release verification following the maintainer's
[RC-1 overnight functional acceptance](rc-1-acceptance.md); it does not claim
another overnight run or new optical latency measurements.

## Physical validation limits

Pi 5 native software encoding is CI-tested. Pi 4 V4L2 M2M hardware encoding,
AMD and NVIDIA GPUs remain physically untested. Pi 5 has no H.264 hardware
encoder; native camera H.264 passthrough or software encoding is required.
Audio was outside the physical test scope. There is no 32-bit ARM or integrated
CSI/libcamera support. See [Raspberry Pi deployment](raspberry-pi.md) for the
dedicated Compose override and device requirements.

`main` contains accepted release code; subsequent feature work and testing stay
on `development`. Ordinary builds publish unique candidates and cannot move
`latest`. Fixed release tags must not be overwritten.
