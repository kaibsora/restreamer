# Security policy

## Supported versions

This fork is pre-release software. Security fixes are applied to the current `2.x`
branch and its subsequently published images; older immutable images are not rebuilt
in place. Use the newest successful `sha-*` image when validating a report.

| Version | Security fixes |
| --- | --- |
| Current `2.x` branch and newest published image | Yes |
| Older commits, tags, and upstream datarhei images | No |

## Reporting a vulnerability

Do not open a public issue for an undisclosed vulnerability. Use GitHub's
[private vulnerability reporting form](https://github.com/kaibsora/restreamer/security/advisories/new)
and include:

- the affected immutable image tag and repository digest;
- the vulnerable endpoint, component, and configuration;
- minimal reproduction steps and expected impact;
- whether authentication, LAN access, a reverse proxy, or a specific media input is
  required;
- suggested mitigations, if known.

Remove unrelated camera credentials, stream keys, and tokens. The fork maintainer
will acknowledge the report through GitHub, reproduce it where possible, and keep
the advisory private until a fix or practical mitigation is available.

## Automated dependency review

The release workflow audits production UI dependencies and runs `govulncheck` at
symbol level against Core. New reachable Go advisories fail the build. Explicit
no-fix exceptions live in `components/core/scripts/check-vulnerabilities.sh` with
their applicability analysis; they are not a wildcard suppression list.

Container, FFmpeg, driver, and host-runtime security remain shared responsibilities.
Do not expose the MediaMTX RTSP, WebRTC, API, or metrics ports to the public Internet
without an authentication and firewall design.
