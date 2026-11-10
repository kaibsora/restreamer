#!/bin/sh
set -eu

usage() {
    echo "Usage: restreamer-hardware-report [--verify] [--require BACKEND]..." >&2
    echo "Backends: nvenc, vaapi, qsv, vulkan" >&2
    echo "Device overrides: RESTREAMER_VAAPI_DEVICE, RESTREAMER_QSV_DEVICE, RESTREAMER_VULKAN_DEVICE" >&2
    exit 64
}

verify=false
required_backends=''
while [ "$#" -gt 0 ]; do
    case "$1" in
        --verify)
            verify=true
            shift
            ;;
        --require)
            [ "$#" -ge 2 ] || usage
            case "$2" in
                nvenc|vaapi|qsv|vulkan) ;;
                *)
                    printf 'Unknown required hardware backend: %s\n' "$2" >&2
                    usage
                    ;;
            esac
            case " ${required_backends} " in
                *" $2 "*) ;;
                *) required_backends="${required_backends}${required_backends:+ }$2" ;;
            esac
            verify=true
            shift 2
            ;;
        *) usage ;;
    esac
done

workdir="$(mktemp -d)"
trap 'rm -rf "${workdir}"' EXIT INT TERM

render_device=''
qsv_render_device=''
vulkan_info=''
nvidia_info=''
configured_vaapi_device="${RESTREAMER_VAAPI_DEVICE:-}"
configured_qsv_device="${RESTREAMER_QSV_DEVICE:-}"

echo "== FFmpeg =="
ffmpeg -hide_banner -version | head -n 3

echo
echo "== Compiled hardware APIs =="
ffmpeg -hide_banner -hwaccels

echo
echo "== Hardware video encoders =="
ffmpeg -hide_banner -encoders 2>/dev/null \
    | grep -E '_(nvenc|vaapi|qsv|vulkan|v4l2m2m)([[:space:]]|$)' \
    || echo "No matching hardware encoders were compiled."

echo
echo "== Video devices =="
for device in /dev/video* /dev/dri/renderD*; do
    if [ -e "${device}" ]; then
        ls -l "${device}"
    fi
done

if command -v vainfo >/dev/null 2>&1; then
    echo
    echo "== VA-API runtime =="

    # Explicit selections are included even when they live outside /dev/dri so
    # the verifier remains testable and works with unusual bind-mount paths.
    {
        for device in /dev/dri/renderD*; do
            [ -e "${device}" ] && printf '%s\n' "${device}"
        done
        [ -z "${configured_vaapi_device}" ] || printf '%s\n' "${configured_vaapi_device}"
        [ -z "${configured_qsv_device}" ] || printf '%s\n' "${configured_qsv_device}"
    } | awk '!seen[$0]++' >"${workdir}/render-devices"

    device_index=0
    while IFS= read -r device; do
        [ -n "${device}" ] || continue
        device_index=$((device_index + 1))
        device_info="${workdir}/vainfo-${device_index}"

        if [ ! -e "${device}" ]; then
            printf 'Configured render device does not exist: %s\n' "${device}" >&2
            continue
        fi

        if vainfo --display drm --device "${device}" >"${device_info}" 2>&1; then
            info="$(cat "${device_info}")"
            printf 'Render device: %s\n%s\n' "${device}" "${info}"

            if [ -z "${render_device}" ] && \
                { [ -z "${configured_vaapi_device}" ] || [ "${device}" = "${configured_vaapi_device}" ]; }; then
                render_device="${device}"
            fi

            if printf '%s\n' "${info}" | grep -Eqi 'Intel|iHD|i965'; then
                if [ -z "${qsv_render_device}" ] && \
                    { [ -z "${configured_qsv_device}" ] || [ "${device}" = "${configured_qsv_device}" ]; }; then
                    qsv_render_device="${device}"
                fi
            fi
        else
            printf 'Unusable VA-API render device: %s\n' "${device}" >&2
            sed 's/^/  /' "${device_info}" >&2
        fi
    done <"${workdir}/render-devices"

    if [ -z "${render_device}" ]; then
        if [ -n "${configured_vaapi_device}" ]; then
            printf 'Configured VA-API render device is unavailable: %s\n' \
                "${configured_vaapi_device}" >&2
        else
            echo "No usable VA-API render device detected."
        fi
    else
        printf 'Selected VA-API render device: %s\n' "${render_device}"
    fi

    if [ -n "${qsv_render_device}" ]; then
        printf 'Selected Quick Sync render device: %s\n' "${qsv_render_device}"
    elif [ -n "${configured_qsv_device}" ]; then
        printf 'Configured Quick Sync render device is unavailable or not Intel: %s\n' \
            "${configured_qsv_device}" >&2
    fi
fi

if command -v vulkaninfo >/dev/null 2>&1; then
    echo
    echo "== Vulkan runtime =="
    if vulkaninfo --summary >"${workdir}/vulkaninfo" 2>&1; then
        vulkan_info="$(cat "${workdir}/vulkaninfo")"
        printf '%s\n' "${vulkan_info}"
    else
        cat "${workdir}/vulkaninfo"
    fi
fi

if command -v nvidia-smi >/dev/null 2>&1; then
    echo
    echo "== NVIDIA runtime =="
    if nvidia-smi >"${workdir}/nvidia-smi" 2>&1; then
        nvidia_info="$(cat "${workdir}/nvidia-smi")"
        printf '%s\n' "${nvidia_info}"
    else
        cat "${workdir}/nvidia-smi"
    fi
fi

if [ "${verify}" != true ]; then
    exit 0
fi

echo
echo "== Active hardware encode verification =="

runtime_count=0
failure_count=0
detected_nvenc=false
detected_vaapi=false
detected_qsv=false
detected_vulkan=false

verify_encoder() {
    label=$1
    shift
    runtime_count=$((runtime_count + 1))

    if "$@" >"${workdir}/encode" 2>&1; then
        printf 'PASS: %s encoded a test frame.\n' "${label}"
    else
        printf 'FAIL: %s could not encode a test frame.\n' "${label}" >&2
        sed 's/^/  /' "${workdir}/encode" >&2
        failure_count=$((failure_count + 1))
    fi
}

if [ -n "${nvidia_info}" ]; then
    detected_nvenc=true
    verify_encoder "NVIDIA NVENC" \
        ffmpeg -hide_banner -loglevel error \
        -f lavfi -i color=size=128x72:rate=1 \
        -frames:v 1 -c:v h264_nvenc -f null -
fi

if [ -n "${render_device}" ]; then
    detected_vaapi=true
    verify_encoder "VA-API (${render_device})" \
        ffmpeg -hide_banner -loglevel error \
        -init_hw_device "vaapi=va:${render_device}" -filter_hw_device va \
        -f lavfi -i color=size=128x72:rate=1 \
        -vf format=nv12,hwupload -frames:v 1 -c:v h264_vaapi -f null -
fi

if [ -n "${qsv_render_device}" ]; then
    detected_qsv=true
    verify_encoder "Intel Quick Sync (${qsv_render_device})" \
        ffmpeg -hide_banner -loglevel error \
        -init_hw_device "vaapi=va:${qsv_render_device}" \
        -init_hw_device qsv=qsv@va -filter_hw_device qsv \
        -f lavfi -i color=size=640x480:rate=30 \
        -vf format=nv12 \
        -frames:v 1 -c:v h264_qsv -low_power 1 -b:v 1000k -async_depth 1 -f null -
fi

if printf '%s\n' "${vulkan_info}" \
    | grep -Eq 'PHYSICAL_DEVICE_TYPE_(DISCRETE|INTEGRATED)_GPU' &&
    vulkaninfo 2>/dev/null | grep -F 'VK_KHR_video_encode_queue' >/dev/null; then
    detected_vulkan=true
    vulkan_device="${RESTREAMER_VULKAN_DEVICE:-0}"
    verify_encoder "Vulkan Video (device ${vulkan_device})" \
        ffmpeg -hide_banner -loglevel error \
        -init_hw_device "vulkan=vk:${vulkan_device}" -filter_hw_device vk \
        -f lavfi -i color=size=128x72:rate=1 \
        -vf format=nv12,hwupload -frames:v 1 -c:v h264_vulkan -f null -
elif [ -n "${vulkan_info}" ]; then
    echo 'SKIP: Vulkan runtime does not advertise hardware video encoding.'
fi

for backend in ${required_backends}; do
    case "${backend}" in
        nvenc) detected=${detected_nvenc} ;;
        vaapi) detected=${detected_vaapi} ;;
        qsv) detected=${detected_qsv} ;;
        vulkan) detected=${detected_vulkan} ;;
    esac

    if [ "${detected}" != true ]; then
        printf 'FAIL: required hardware backend %s was not detected.\n' \
            "${backend}" >&2
        failure_count=$((failure_count + 1))
    fi
done

if [ "${runtime_count}" -eq 0 ]; then
    echo "FAIL: no usable hardware-encoding runtime was detected." >&2
    exit 2
fi

if [ "${failure_count}" -ne 0 ]; then
    printf 'Hardware verification failed with %s error(s).\n' \
        "${failure_count}" >&2
    exit 1
fi

printf 'Hardware verification passed for %s runtime(s).\n' "${runtime_count}"
if [ -n "${required_backends}" ]; then
    printf 'Required hardware backends passed: %s\n' "${required_backends}"
fi
