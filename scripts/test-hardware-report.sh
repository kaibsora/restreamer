#!/usr/bin/env bash
set -euo pipefail

repository_root="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
fixture_root="$(mktemp -d "${TMPDIR:-/tmp}/restreamer-hardware-test.XXXXXX")"
trap 'rm -rf -- "${fixture_root}"' EXIT

mkdir -p "${fixture_root}/bin"

cat >"${fixture_root}/bin/ffmpeg" <<'EOF'
#!/bin/sh
case " $* " in
    *' -version '*)
        printf '%s\n' 'ffmpeg version test'
        ;;
    *' -hwaccels '*)
        printf '%s\n' 'Hardware acceleration methods:' 'cuda'
        ;;
    *' -encoders '*)
        printf '%s\n' ' V....D h264_nvenc test encoder'
        ;;
    *' -c:v h264_nvenc '*)
        [ "${FAKE_NVENC_FAIL:-false}" != true ]
        ;;
    *)
        exit 1
        ;;
esac
EOF

cat >"${fixture_root}/bin/nvidia-smi" <<'EOF'
#!/bin/sh
printf '%s\n' 'NVIDIA-SMI test runtime'
EOF

for command in vainfo vulkaninfo; do
    cat >"${fixture_root}/bin/${command}" <<'EOF'
#!/bin/sh
exit 1
EOF
done

chmod +x "${fixture_root}/bin/"*

test_path="${fixture_root}/bin:/usr/bin:/bin"

output="$(PATH="${test_path}" \
    "${repository_root}/scripts/hardware-report.sh" \
    --verify --require nvenc)"
grep -F 'PASS: NVIDIA NVENC encoded a test frame.' <<<"${output}" >/dev/null
grep -F 'Required hardware backends passed: nvenc' <<<"${output}" >/dev/null

if PATH="${test_path}" "${repository_root}/scripts/hardware-report.sh" \
    --verify --require qsv >"${fixture_root}/missing" 2>&1; then
    printf '%s\n' 'Expected a missing required QSV backend to fail.' >&2
    exit 1
fi
grep -F 'required hardware backend qsv was not detected' \
    "${fixture_root}/missing" >/dev/null

if PATH="${test_path}" "${repository_root}/scripts/hardware-report.sh" \
    --require imaginary >"${fixture_root}/invalid" 2>&1; then
    printf '%s\n' 'Expected an unknown required backend to fail.' >&2
    exit 1
fi
grep -F 'Unknown required hardware backend: imaginary' \
    "${fixture_root}/invalid" >/dev/null

if PATH="${test_path}" FAKE_NVENC_FAIL=true \
    "${repository_root}/scripts/hardware-report.sh" \
    --verify --require nvenc >"${fixture_root}/encode-failure" 2>&1; then
    printf '%s\n' 'Expected a failed NVENC encode to fail verification.' >&2
    exit 1
fi
grep -F 'FAIL: NVIDIA NVENC could not encode a test frame.' \
    "${fixture_root}/encode-failure" >/dev/null

if ACCEPT_VERIFY_HARDWARE=false ACCEPT_HARDWARE_BACKENDS=qsv \
    "${repository_root}/scripts/accept-deployment.sh" \
    rtsp://camera.invalid/stream >"${fixture_root}/disabled-requirement" 2>&1; then
    printf '%s\n' 'Expected disabled verification with a requirement to fail.' >&2
    exit 1
fi
grep -F 'ACCEPT_HARDWARE_BACKENDS requires ACCEPT_VERIFY_HARDWARE=true.' \
    "${fixture_root}/disabled-requirement" >/dev/null

if ACCEPT_HARDWARE_BACKENDS=imaginary \
    "${repository_root}/scripts/accept-deployment.sh" \
    rtsp://camera.invalid/stream >"${fixture_root}/invalid-acceptance" 2>&1; then
    printf '%s\n' 'Expected an invalid acceptance backend to fail.' >&2
    exit 1
fi
grep -F 'ACCEPT_HARDWARE_BACKENDS contains an invalid backend' \
    "${fixture_root}/invalid-acceptance" >/dev/null

printf '%s\n' 'Hardware-report backend requirement tests passed.'
