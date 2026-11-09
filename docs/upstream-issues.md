# Upstream issue ledger

This ledger connects inherited datarhei Restreamer reports to evidence in this fork.
It is not a claim that every upstream report has the same root cause in every
environment. A status is recorded only when code and regression coverage exist here;
physical GPU claims remain pending until a real device completes the hardware gate.

## Implemented and covered

| Upstream report | Resolution in this fork | Evidence |
| --- | --- | --- |
| [#841: RTMP application path is lost](https://github.com/datarhei/restreamer/issues/841) | Preserves an explicitly supplied RTMP application name. | `75ad1289`, UI regression tests |
| [#851: Swagger does not send bearer authentication](https://github.com/datarhei/restreamer/issues/851) | Swagger UI now declares and sends bearer credentials. | `cf734c57`, Core Swagger tests |
| [#856: viewer statistics ignore X-Forwarded-For](https://github.com/datarhei/restreamer/issues/856) | Resolves trusted private-proxy chains without accepting spoofed headers from public peers. | `e96eadc4`, Core client-IP and HLS ignore-list tests |
| [#869: stale update notification](https://github.com/datarhei/restreamer/issues/869) | Removes the abandoned upstream update check and telemetry path. | `cb7c1fe8`, configuration compatibility tests |
| [#892: disable the default player page](https://github.com/datarhei/restreamer/issues/892) | Exposes a clear landing-page publication switch and removes the root page, every generated per-channel page, and the generated player-site script without stopping direct media publications. | `ad255a23`, `restreamer.playersite.test.js`, UI production build |
| [#898: Instagram publication fails](https://github.com/datarhei/restreamer/issues/898) | Updates the Instagram RTMPS endpoint and publication defaults. | `9fdc440b`, UI publication tests |
| [#930: start and stop through the API](https://github.com/datarhei/restreamer/issues/930) and [#907: enable or disable a publication](https://github.com/datarhei/restreamer/issues/907) | Documents and exercises authenticated process list, start, stop, and restart operations. | `30fafd30`, `docs/api-process-control.md`, compose smoke gate |
| [#938: no silent-audio settings](https://github.com/datarhei/restreamer/issues/938) and [#954: wizard creates two video mappings](https://github.com/datarhei/restreamer/issues/954) | Preserves the generated `anullsrc` input and maps it as audio. | `135ba16c`, `f680cc94`, wizard regression tests |
| [#941: output to RTP/MPEG-TS](https://github.com/datarhei/restreamer/issues/941) | Adds selectable RTP/MPEG-TS multicast output with packet-size and TTL controls, codec-header insertion, and unchanged UDP/TCP behavior. | `0ebc766d`, `MPEGTS.test.jsx`, FFmpeg muxer/protocol contract, loopback decode |
| [#943: passthrough frame-rate mode fails](https://github.com/datarhei/restreamer/issues/943) | Omits output `-r` for passthrough and VFR modes while retaining it for CFR and legacy FFmpeg. | `f75b1144`, tests across all exposed encoders |
| [#845](https://github.com/datarhei/restreamer/issues/845), [#847](https://github.com/datarhei/restreamer/issues/847), and [#912](https://github.com/datarhei/restreamer/issues/912): player logo does not appear | Restores the configured logo in the public Video.js player and preserves the branding asset during channel migration. This is a browser overlay, not a watermark burned into transcoded video. | `bace594e`, `f78ad046`, UI and compose smoke tests |
| [#946: overlay channel logo and name](https://github.com/datarhei/restreamer/issues/946) and [#982: custom hardcoded watermark](https://github.com/datarhei/restreamer/issues/982) | Burns a persistent PNG/JPEG and optional UTF-8 text into the transcoded ingest with independent position, size, opacity, color, margin, and text-background controls. Every publication and relay derived from the ingest receives the encoded branding. | `b94f34ef`, `Watermark.test.jsx`, FFmpeg image/text filtergraph execution, channel migration tests, FFmpeg filter/font build contract |
| [#950: snapshot returns file-not-found](https://github.com/datarhei/restreamer/issues/950) | Covers snapshot process creation, file production, and cleanup through the Core API. | `b178f484`, managed snapshot lifecycle gate |
| [#955: migrate selected channels](https://github.com/datarhei/restreamer/issues/955) | Adds versioned single-channel export/import with ID remapping, asset transfer, and rollback. | `d67d3da6`, UI migration tests |
| [#957: API fails behind IIS](https://github.com/datarhei/restreamer/issues/957) | Documents complete-site IIS routing alongside NGINX and Caddy examples. | `5aa6f750`, `docs/reverse-proxy.md` |
| [#958: 25 MiB loop-file upload limit](https://github.com/datarhei/restreamer/issues/958) | Streams audio and video loop uploads instead of buffering them into a browser-held array. | `ee4b04f2`, UI upload tests |
| [#966: RTMP simple handshake returns the wrong S2 payload](https://github.com/datarhei/restreamer/issues/966) | Generates an independent server S1 challenge and echoes the client C1 payload in S2, matching the simple-handshake protocol expected by strict librtmp clients. | `33989d32`, `rtmp.TestSimpleHandshakeEchoesC1InS2` |

## Implemented, awaiting physical acceptance

| Upstream report | Current evidence | Missing evidence |
| --- | --- | --- |
| [#852: GPU encoding](https://github.com/datarhei/restreamer/issues/852) and [#920: no video on CUDA image](https://github.com/datarhei/restreamer/issues/920) | One image exposes NVENC/NVDEC, CUDA, VA-API, QSV, and Vulkan encoders; build verification rejects a missing backend. | Successful encode artifacts from representative NVIDIA, Intel, and AMD hosts. |
| [#945: AV1 on VA-API](https://github.com/datarhei/restreamer/issues/945) | AV1 VA-API is compiled, exposed in the UI, and checked in the FFmpeg contract. | A real AV1-capable VA-API device completing `accept-hardware.yml`. |
| [#890: USB capture cards do not work](https://github.com/datarhei/restreamer/issues/890) and [#918: USB grabber problem](https://github.com/datarhei/restreamer/issues/918) | V4L2 discovery fallback, device mapping, and synthetic multi-camera paths are covered. | Representative USB capture devices tested through the deployed container. |
| [#936: USB capture audio drifts behind video](https://github.com/datarhei/restreamer/issues/936) | Encoded audio enables bounded timestamp-driven clock compensation by default; UI graph tests and an executable FFmpeg skew contract prove sample correction. | A long-running capture from an independently clocked V4L2/ALSA USB device confirming sustained audio/video synchronization. |
| [#934: reduce default player delay](https://github.com/datarhei/restreamer/issues/934), [#942: high LAN SRT latency](https://github.com/datarhei/restreamer/issues/942), and [#974: high latency](https://github.com/datarhei/restreamer/issues/974) | MediaMTX RTSP/WHEP relay topology and concurrent sub-second first-frame gates are included. | Glass-to-glass measurements on the final cameras, network, browsers, and printer dashboards. |

The manual hardware workflow records the pulled repository digest and uploads its
full report as a retained Actions artifact. A backend moves out of the pending table
only after that workflow completes an actual encode. An encoder appearing in
`ffmpeg -encoders` proves that a binary contains code; it does not prove the kernel,
driver, container runtime, and silicon have agreed to speak to one another.
