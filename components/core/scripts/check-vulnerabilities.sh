#!/usr/bin/env bash
set -uo pipefail

scanner_version="${GOVULNCHECK_VERSION:-v1.9.0}"
report="$(mktemp "${TMPDIR:-/tmp}/restreamer-govulncheck.XXXXXX")"
trap 'rm -f -- "${report}"' EXIT

# Echo 4.16.3 has no fixed release for these two advisories. They affect Echo's
# reverse-proxy and rate-limiter middleware defaults. Core configures neither
# middleware and installs its own private-peer-only forwarded-IP extractor, covered
# by http/server_clientip_test.go. Keep the exceptions explicit so any new finding
# still fails CI.
allowed=(
    GO-2026-6872
    GO-2026-6875
)

set +e
go run "golang.org/x/vuln/cmd/govulncheck@${scanner_version}" ./... \
    >"${report}" 2>&1
status=$?
set -e

cat "${report}"

if (( status == 0 )); then
    printf '%s\n' 'Go vulnerability scan passed with no reachable findings.'
    exit 0
fi

if ! grep -F 'Your code is affected by' "${report}" >/dev/null; then
    printf '%s\n' 'govulncheck failed without producing a vulnerability result.' >&2
    exit "${status}"
fi

mapfile -t findings < <(
    sed -n 's#.*https://pkg.go.dev/vuln/\(GO-[0-9-]*\).*#\1#p' "${report}" \
        | sort -u
)

if (( ${#findings[@]} == 0 )); then
    printf '%s\n' 'govulncheck reported affected code without advisory IDs.' >&2
    exit 1
fi

unexpected=()
for finding in "${findings[@]}"; do
    reviewed=false
    for exception in "${allowed[@]}"; do
        if [[ "${finding}" == "${exception}" ]]; then
            reviewed=true
            break
        fi
    done
    if [[ "${reviewed}" != true ]]; then
        unexpected+=("${finding}")
    fi
done

if (( ${#unexpected[@]} != 0 )); then
    printf 'Unreviewed reachable Go vulnerabilities: %s\n' \
        "${unexpected[*]}" >&2
    exit 1
fi

printf 'Go vulnerability scan passed with reviewed no-fix exceptions: %s\n' \
    "${findings[*]}"
