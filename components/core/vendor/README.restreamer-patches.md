# Restreamer vendor patches

The Core module vendors dependencies so release builds remain reproducible. The
following fixes are intentionally applied after `go mod vendor` and must be retained
until Core advances to a Joy4 revision that contains them.

## Joy4 simple RTMP handshake

- File: `github.com/datarhei/joy4/format/rtmp/rtmp.go`
- Upstream commit: `5c88740f7f553213eb1363bb75fe740471db602f`
- Restreamer issue: `datarhei/restreamer#966`

Joy4's old simple-handshake server copied `S2` from `C2` before the client had sent
`C2`, producing an all-zero response. The backport gives `S1` server-owned random
data and echoes `C1` in `S2`, matching the upstream fix and strict librtmp clients.
`rtmp.TestSimpleHandshakeEchoesC1InS2` exercises the vendored server over an actual
in-memory connection and will fail if vendoring discards the patch.
