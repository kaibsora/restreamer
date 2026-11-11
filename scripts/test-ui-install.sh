#!/usr/bin/env bash
set -euo pipefail
installer="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)/components/ui/scripts/install-ci.sh"
fixture="$(mktemp -d)"
trap 'rm -rf -- "${fixture}"' EXIT
mkdir "${fixture}/bin"
export INSTALL_COUNT="${fixture}/count"
cat > "${fixture}/bin/yarn" <<'EOF'
#!/bin/sh
printf '%s\n' "$@" | grep -Fx -- '--frozen-lockfile' >/dev/null || exit 9
count=0
[ ! -f "$INSTALL_COUNT" ] || count=$(cat "$INSTALL_COUNT")
count=$((count + 1))
echo "$count" > "$INSTALL_COUNT"
if [ "$INSTALL_MODE" = recover ] && [ "$count" -ge 2 ]; then exit 0; fi
echo 'Simulated package socket timeout' >&2
exit 1
EOF
printf '#!/bin/sh\nexit 0\n' > "${fixture}/bin/sleep"
chmod +x "${fixture}/bin/"*
export PATH="${fixture}/bin:${PATH}"
INSTALL_MODE=recover sh "${installer}" >/dev/null 2>&1
[[ "$(cat "${INSTALL_COUNT}")" == 2 ]]
echo 0 > "${INSTALL_COUNT}"
if INSTALL_MODE=fail sh "${installer}" >/dev/null 2>&1; then
    echo 'A permanently failed install must block the build.' >&2
    exit 1
fi
[[ "$(cat "${INSTALL_COUNT}")" == 3 ]]
echo 'PASS: frozen dependency fetch recovers from a transient error and fails after three unsuccessful attempts.'
