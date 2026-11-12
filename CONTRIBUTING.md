# Contributing

CQComber Restreamer is an independent adaptation of datarhei Restreamer.
Report defects caused by this fork in
[`kaibsora/restreamer`](https://github.com/kaibsora/restreamer/issues), not in the
original projects. The upstream maintainers did not volunteer to debug our
renovation.

## Before opening an issue

Use a `ghcr.io/kaibsora/restreamer:build-<run>-<attempt>` tag or image digest when possible and include:

- the complete image tag and repository digest;
- output from `docker exec restreamer restreamer-hardware-report`;
- host OS, architecture, Docker version, GPU model, and host driver version;
- camera type, transport, codec, resolution, frame rate, and relevant URL with
  credentials and tokens removed;
- the generated FFmpeg command and the first relevant error block from the process
  log;
- whether the failure occurs through the LAN address, reverse proxy, or both.

Never publish camera passwords, stream keys, access tokens, exported channel bundles,
or complete configuration files without redacting them. A beautifully detailed bug
report is less useful after it also becomes a credential-distribution service.

For latency reports, distinguish connection startup, transport latency, and physical
glass-to-glass delay. Include the measurement method and whether the stream is copied
or transcoded. “It feels slow” is valid frustration but regrettably not a unit.

## Development

Use the `development` branch for future changes. `main` holds accepted release
code. Open feature/fix pull requests against `development`; promote reviewed and
physically accepted changes back to `main` for a public release. Candidate image
builds never update `latest`. Run `promote-release.yml` on `main` with the accepted
image digest, exact application commit and a new version such as `1.0.0` to publish
without rebuilding. Stable versions update their minor/major aliases and `latest`;
an `rc-N` tag is immutable and does not move stable aliases. The workflow refuses
development images and conflicting fixed tags. Preserve the source-image digest
and verification evidence with each release.
For hardware acceptance, explicitly pass the candidate build tag/digest; the
hardware workflow's `latest` default only checks the already accepted release.
Keep the About release label as `Development` on this branch. Set it to the
upcoming release version on the release preparation branch before merging to
`main` and building the release image.

The maintained source lives in one repository:

- `components/core` — Go backend and process manager;
- `components/ui` — React administration and player UI;
- `components/ffmpeg` — FFmpeg build, verification, and Restreamer patches;
- `deploy` — Compose and MediaMTX deployment assets;
- `scripts` — release and acceptance gates.

Keep changes scoped and add a regression test for every reproducible defect. Before
submitting a pull request, run the checks relevant to the files you changed. The
GitHub workflow runs the complete UI, Core, configuration, image, and camera-stack
gates on the private ARC runners.

Do not commit generated UI build output, local Core binaries, camera media, secrets,
or Docker credentials. Pull requests from forks are intentionally not executed on
the private runners because unreviewed code plus a Docker socket is not a CI design;
it is an incident report waiting for a timestamp.

## Upstream provenance

Preserve original copyright notices and component history. When fixing an inherited
problem, reference the applicable `datarhei/restreamer`, `datarhei/restreamer-ui`,
`datarhei/core`, or `datarhei/ffmpeg` issue in the commit or pull request. Update
[`docs/upstream-issues.md`](docs/upstream-issues.md) only after a test or runtime gate
provides evidence for the claimed status.

Synchronization from the original repositories must be reviewed component by
component. Do not replace the unified tree wholesale: this fork contains build,
hardware, latency, migration, and security changes that do not exist upstream.
