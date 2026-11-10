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
    *' -c:v h264_vaapi '*|*' -c:v h264_qsv '*)
        [ -z "${FAKE_FFMPEG_LOG:-}" ] || printf '%s\n' "$*" >>"${FAKE_FFMPEG_LOG}"
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

cat >"${fixture_root}/bin/vainfo" <<'EOF'
#!/bin/sh
case "$*" in
    *renderD128*) printf '%s\n' 'Mesa Gallium driver AMD Radeon test runtime' ;;
    *renderD129*) printf '%s\n' 'Intel iHD test runtime' ;;
    *) exit 1 ;;
esac
EOF

cat >"${fixture_root}/bin/vulkaninfo" <<'EOF'
#!/bin/sh
if [ "${FAKE_VULKAN_NO_ENCODE:-false}" = true ]; then
    printf '%s\n' 'PHYSICAL_DEVICE_TYPE_INTEGRATED_GPU'
    exit 0
fi
exit 1
EOF

chmod +x "${fixture_root}/bin/"*

test_path="${fixture_root}/bin:/usr/bin:/bin"

mkdir -p "${fixture_root}/dri"
touch "${fixture_root}/dri/renderD128" "${fixture_root}/dri/renderD129"

output="$(PATH="${test_path}" \
    "${repository_root}/scripts/hardware-report.sh" \
    --verify --require nvenc)"
grep -F 'PASS: NVIDIA NVENC encoded a test frame.' <<<"${output}" >/dev/null
grep -F 'Required hardware backends passed: nvenc' <<<"${output}" >/dev/null

output="$(PATH="${test_path}" FAKE_VULKAN_NO_ENCODE=true \
    "${repository_root}/scripts/hardware-report.sh" --verify --require nvenc)"
grep -F 'SKIP: Vulkan runtime does not advertise hardware video encoding.' <<<"${output}" >/dev/null
if PATH="${test_path}" FAKE_VULKAN_NO_ENCODE=true \
    "${repository_root}/scripts/hardware-report.sh" --require vulkan >"${fixture_root}/unsupported-vulkan" 2>&1; then
    printf '%s\n' 'Expected a required unsupported Vulkan encoder to fail.' >&2
    exit 1
fi
grep -F 'required hardware backend vulkan was not detected' "${fixture_root}/unsupported-vulkan" >/dev/null

ffmpeg_log="${fixture_root}/ffmpeg.log"
output="$(PATH="${test_path}" \
    FAKE_FFMPEG_LOG="${ffmpeg_log}" \
    RESTREAMER_VAAPI_DEVICE="${fixture_root}/dri/renderD128" \
    RESTREAMER_QSV_DEVICE="${fixture_root}/dri/renderD129" \
    "${repository_root}/scripts/hardware-report.sh" \
    --verify --require vaapi --require qsv)"
grep -F "Selected VA-API render device: ${fixture_root}/dri/renderD128" \
    <<<"${output}" >/dev/null
grep -F "Selected Quick Sync render device: ${fixture_root}/dri/renderD129" \
    <<<"${output}" >/dev/null
grep -F "PASS: VA-API (${fixture_root}/dri/renderD128) encoded a test frame." \
    <<<"${output}" >/dev/null
grep -F "PASS: Intel Quick Sync (${fixture_root}/dri/renderD129) encoded a test frame." \
    <<<"${output}" >/dev/null
grep -F "vaapi=va:${fixture_root}/dri/renderD128" "${ffmpeg_log}" >/dev/null
grep -F "vaapi=va:${fixture_root}/dri/renderD129" "${ffmpeg_log}" >/dev/null

output="$(PATH="${test_path}" \
    FAKE_FFMPEG_LOG="${ffmpeg_log}" \
    RESTREAMER_VAAPI_DEVICE="${fixture_root}/dri/missing" \
    RESTREAMER_QSV_DEVICE="${fixture_root}/dri/renderD129" \
    "${repository_root}/scripts/hardware-report.sh" \
    --verify --require qsv 2>"${fixture_root}/independent-qsv")"
grep -F "PASS: Intel Quick Sync (${fixture_root}/dri/renderD129) encoded a test frame." \
    <<<"${output}" >/dev/null
grep -F 'Configured VA-API render device is unavailable' \
    "${fixture_root}/independent-qsv" >/dev/null

if PATH="${test_path}" \
    RESTREAMER_VAAPI_DEVICE="${fixture_root}/dri/missing" \
    "${repository_root}/scripts/hardware-report.sh" \
    --verify --require vaapi >"${fixture_root}/missing-vaapi" 2>&1; then
    printf '%s\n' 'Expected a missing configured VA-API device to fail.' >&2
    exit 1
fi
grep -F 'Configured VA-API render device is unavailable' \
    "${fixture_root}/missing-vaapi" >/dev/null

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
