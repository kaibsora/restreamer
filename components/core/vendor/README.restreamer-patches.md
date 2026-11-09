# Restreamer vendor patches

The Core module vendors dependencies so release builds remain reproducible. The
following fixes are intentionally applied after `go mod vendor` and must be retained
until Core advances to dependency revisions that contain them.

## Joy4 simple RTMP handshake

- File: `github.com/datarhei/joy4/format/rtmp/rtmp.go`
- Upstream commit: `5c88740f7f553213eb1363bb75fe740471db602f`
- Restreamer issue: `datarhei/restreamer#966`

Joy4's old simple-handshake server copied `S2` from `C2` before the client had sent
`C2`, producing an all-zero response. The backport gives `S1` server-owned random
data and echoes `C1` in `S2`, matching the upstream fix and strict librtmp clients.
`rtmp.TestSimpleHandshakeEchoesC1InS2` exercises the vendored server over an actual
in-memory connection and will fail if vendoring discards the patch.

## Joy4 late RTMP timestamp recovery

- File: `github.com/datarhei/joy4/format/rtmp/rtmp.go`
- Restreamer issue: `datarhei/restreamer#952`

Joy4 switched to connection-wall-clock timestamps when a publisher started with a
broken media clock, but disconnected the same publisher when its timestamps froze
after the first twenty packets. Long-running cameras can develop precisely that
late fault. The patch consistently switches the affected RTMP chunk stream to its
connection wall clock instead of turning a recoverable clock defect into a dead
pull URL. `rtmp.TestPublisherContinuesAfterTimestampFreeze` publishes normally,
then freezes AAC timestamps after packet 25 over a real loopback TCP connection.

## echo-swagger automatic Bearer authentication

- File: `github.com/swaggo/echo-swagger/swagger.go`
- Restreamer issue: `datarhei/restreamer#851`

Swagger 2 represents Bearer authentication as an `apiKey` in the `Authorization`
header, so Swagger UI otherwise sends a pasted JWT without the required `Bearer`
scheme. The `AutoBearerAuth` option installs a request interceptor that prefixes raw
tokens while preserving explicit `Bearer`, `Basic`, and other authentication schemes.
`http.TestSwaggerAutoBearerAuth` protects both the opt-in behavior and the default
upstream behavior so a future dependency refresh cannot silently remove the fix.
