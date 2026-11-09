---
name: Bug report
about: Report a reproducible defect in this fork
title: "[Bug] "
labels: bug
assignees: ""
---

## Image identity

- Image tag:
- Repository digest:
- Output of `docker exec restreamer restreamer-hardware-report`:

## Environment

- Host OS and architecture:
- Docker Engine and Compose versions:
- GPU model, host driver, and container runtime:
- Camera/source type, codec, resolution, and frame rate:
- Browser/client and version:
- Direct LAN, reverse proxy, or both:

## Reproduction

1.
2.
3.

## Expected behavior

Describe what should happen.

## Actual behavior

Describe what happens and include the generated FFmpeg command plus the first relevant
error block. Remove passwords, camera URLs containing credentials, stream keys, and
tokens before posting.

## Additional context

For latency reports, include the measurement method and say whether the stream is
copied or transcoded. Attach screenshots or short, credential-free samples only when
they materially help reproduce the problem.
