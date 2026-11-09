#!/usr/bin/env bash
set -euo pipefail

container="${RESTREAMER_CONTAINER:-restreamer}"
base_url="${RESTREAMER_BASE_URL:-http://127.0.0.1:8080}"
max_first_frame_ms="${ACCEPT_MAX_FIRST_FRAME_MS:-1000}"
probe_timeout_seconds="${ACCEPT_PROBE_TIMEOUT_SECONDS:-8}"
verify_hardware="${ACCEPT_VERIFY_HARDWARE:-true}"
required_hardware_backends="${ACCEPT_HARDWARE_BACKENDS:-}"
sample_seconds="${ACCEPT_SAMPLE_SECONDS:-10}"
min_sample_fps="${ACCEPT_MIN_SAMPLE_FPS:-1}"
report_file="${ACCEPT_REPORT_FILE:-}"

usage() {
    cat >&2 <<'EOF'
Usage: scripts/accept-deployment.sh SOURCE [SOURCE ...]

Probe camera sources concurrently through the running Restreamer container.
Supported sources:
  rtsp://host/path       RTSP camera or relay
  http[s]://host/path    HTTP camera stream
  v4l2:/dev/videoN      USB/V4L2 camera mapped into the container

Environment:
  RESTREAMER_CONTAINER          Container name (default: restreamer)
  RESTREAMER_BASE_URL           API URL (default: http://127.0.0.1:8080)
  ACCEPT_MAX_FIRST_FRAME_MS     Per-camera limit (default: 1000)
  ACCEPT_PROBE_TIMEOUT_SECONDS  Hard probe timeout (default: 8)
  ACCEPT_VERIFY_HARDWARE        Run active GPU encoding checks (default: true)
  ACCEPT_HARDWARE_BACKENDS      Comma-separated required GPU backends
                                (nvenc, vaapi, qsv, vulkan)
  ACCEPT_SAMPLE_SECONDS         Sustained decode window (default: 10)
  ACCEPT_MIN_SAMPLE_FPS         Minimum decoded FPS during the window (default: 1)
  ACCEPT_REPORT_FILE            Optional JSON report output path
EOF
    exit 64
}

[[ $# -gt 0 ]] || usage

for value_name in max_first_frame_ms probe_timeout_seconds sample_seconds min_sample_fps; do
    value="${!value_name}"
    if [[ ! "${value}" =~ ^[1-9][0-9]*$ ]]; then
        printf '%s must be a positive integer, got %q.\n' \
            "${value_name}" "${value}" >&2
        exit 64
    fi
done

case "${verify_hardware}" in
    true|false) ;;
    *)
        printf 'ACCEPT_VERIFY_HARDWARE must be true or false, got %q.\n' \
            "${verify_hardware}" >&2
        exit 64
        ;;
esac

hardware_backends=()
if [[ -n "${required_hardware_backends}" ]]; then
    IFS=',' read -r -a hardware_backends <<<"${required_hardware_backends}"
    for backend in "${hardware_backends[@]}"; do
        case "${backend}" in
            nvenc|vaapi|qsv|vulkan) ;;
            *)
                printf 'ACCEPT_HARDWARE_BACKENDS contains an invalid backend: %q.\n' \
                    "${backend}" >&2
                exit 64
                ;;
        esac
    done
fi

if [[ "${verify_hardware}" != true && ${#hardware_backends[@]} -ne 0 ]]; then
    printf '%s\n' \
        'ACCEPT_HARDWARE_BACKENDS requires ACCEPT_VERIFY_HARDWARE=true.' >&2
    exit 64
fi

if [[ -n "${report_file}" && ! -d "$(dirname -- "${report_file}")" ]]; then
    printf 'ACCEPT_REPORT_FILE parent directory does not exist: %q\n' \
        "$(dirname -- "${report_file}")" >&2
    exit 64
fi

container_running=$(docker container inspect \
    --format '{{.State.Running}}' "${container}" 2>/dev/null || true)
if [[ "${container_running}" != true ]]; then
    printf 'Restreamer container %q is not running.\n' "${container}" >&2
    exit 1
fi

curl --fail --silent --show-error "${base_url%/}/api" >/dev/null

if [[ "${verify_hardware}" == true ]]; then
    printf '%s\n' 'Running active hardware-encode verification...'
    hardware_args=(--verify)
    for backend in "${hardware_backends[@]}"; do
        hardware_args+=(--require "${backend}")
    done
    docker exec "${container}" restreamer-hardware-report "${hardware_args[@]}"
fi

result_dir="$(mktemp -d "${TMPDIR:-/tmp}/restreamer-accept.XXXXXX")"
report_tmp=""
cleanup() {
    rm -f -- "${result_dir}"/*.json
    rmdir -- "${result_dir}" 2>/dev/null || true
    if [[ -n "${report_tmp}" ]]; then
        rm -f -- "${report_tmp}"
    fi
}
trap cleanup EXIT

json_escape() {
    local value=$1
    value=${value//\\/\\\\}
    value=${value//\"/\\\"}
    value=${value//$'\n'/\\n}
    value=${value//$'\r'/\\r}
    value=${value//$'\t'/\\t}
    printf '%s' "${value}"
}

redact_source() {
    local source=$1
    local redacted
    if [[ "${source}" =~ ^(https?|rtsp)://[^/@]+@(.+)$ ]]; then
        redacted="${BASH_REMATCH[1]}://***@${BASH_REMATCH[2]}"
    else
        redacted=${source}
    fi

    if [[ "${redacted}" == *\?* ]]; then
        redacted="${redacted%%\?*}?***"
    elif [[ "${redacted}" == *\#* ]]; then
        redacted="${redacted%%\#*}#***"
    fi
    printf '%s' "${redacted}"
}

write_result() {
    local index=$1
    local source=$2
    local passed=$3
    local first_frame_ms=$4
    local decoded_frames=$5
    local message=$6
    local safe_source
    safe_source="$(redact_source "${source}")"

    printf '{"index":%s,"source":"%s","passed":%s,' \
        "${index}" "$(json_escape "${safe_source}")" "${passed}" \
        >"${result_dir}/${index}.json"
    printf '"first_frame_ms":%s,"sample_seconds":%s,' \
        "${first_frame_ms}" "${sample_seconds}" \
        >>"${result_dir}/${index}.json"
    printf '"decoded_frames":%s,"message":"%s"}\n' \
        "${decoded_frames}" "$(json_escape "${message}")" \
        >>"${result_dir}/${index}.json"
}

probe_source() {
    local index=$1
    local source=$2
    local started_ms finished_ms elapsed_ms
    local sample_timeout_seconds progress_output decoded_frames json_frame minimum_frames
    local input_args=()

    case "${source}" in
        rtsp://*)
            input_args=(
                -rtsp_transport tcp
                -fflags nobuffer
                -flags low_delay
                -avioflags direct
                -analyzeduration 0
                -probesize 32
                -i "${source}"
            )
            ;;
        http://*|https://*)
            input_args=(
                -fflags nobuffer
                -flags low_delay
                -analyzeduration 0
                -probesize 32
                -i "${source}"
            )
            ;;
        v4l2:/dev/video*)
            input_args=(-f v4l2 -thread_queue_size 2 -i "${source#v4l2:}")
            ;;
        *)
            printf 'Camera %s has an unsupported source type.\n' "${index}" >&2
            write_result "${index}" "${source}" false null null \
                'unsupported source type'
            return 1
            ;;
    esac

    started_ms=$(date +%s%3N)
    if ! MSYS_NO_PATHCONV=1 docker exec "${container}" \
        timeout "${probe_timeout_seconds}" \
        ffmpeg -hide_banner -loglevel error \
        "${input_args[@]}" \
        -map 0:v:0 -frames:v 1 -f null - >/dev/null 2>&1; then
        printf 'Camera %s did not produce a decoded frame within %ss.\n' \
            "${index}" "${probe_timeout_seconds}" >&2
        write_result "${index}" "${source}" false null null \
            'first decoded frame was not produced before the probe timeout'
        return 1
    fi

    finished_ms=$(date +%s%3N)
    elapsed_ms=$((finished_ms - started_ms))
    if (( elapsed_ms >= max_first_frame_ms )); then
        printf 'Camera %s first-frame readback took %sms (limit: %sms).\n' \
            "${index}" "${elapsed_ms}" "${max_first_frame_ms}" >&2
        write_result "${index}" "${source}" false "${elapsed_ms}" null \
            'first-frame readback exceeded the configured limit'
        return 1
    fi

    sample_timeout_seconds=$((probe_timeout_seconds + sample_seconds + 2))
    if ! progress_output="$(MSYS_NO_PATHCONV=1 docker exec "${container}" \
        timeout "${sample_timeout_seconds}" \
        ffmpeg -hide_banner -loglevel error -progress pipe:1 -nostats \
        "${input_args[@]}" \
        -map 0:v:0 -an -t "${sample_seconds}" -f null - 2>&1)"; then
        printf 'Camera %s did not sustain decoding for %ss.\n' \
            "${index}" "${sample_seconds}" >&2
        write_result "${index}" "${source}" false "${elapsed_ms}" null \
            'sustained decode failed or timed out'
        return 1
    fi

    decoded_frames="$(awk -F= '
        $1 == "frame" { gsub(/\r/, "", $2); frames = $2 }
        END { print frames + 0 }
    ' <<<"${progress_output}")"
    if (( decoded_frames == 0 )); then
        # Restreamer's FFmpeg patches emit progress as ffmpeg.progress JSON
        # instead of the upstream frame=N records. The final frame member is
        # the aggregate output count; earlier members describe each stream.
        json_frame="$(grep -oE '"frame":[0-9]+' <<<"${progress_output}" \
            | tail -n 1 | cut -d: -f2 || true)"
        if [[ "${json_frame}" =~ ^[0-9]+$ ]]; then
            decoded_frames=${json_frame}
        fi
    fi
    minimum_frames=$((sample_seconds * min_sample_fps))
    if (( decoded_frames < minimum_frames )); then
        printf 'Camera %s decoded %s frames in %ss (minimum: %s).\n' \
            "${index}" "${decoded_frames}" "${sample_seconds}" \
            "${minimum_frames}" >&2
        write_result "${index}" "${source}" false "${elapsed_ms}" \
            "${decoded_frames}" 'sustained decode rate was below the configured minimum'
        return 1
    fi

    printf 'Camera %s first-frame readback: %sms; sustained decode: %s frames in %ss.\n' \
        "${index}" "${elapsed_ms}" "${decoded_frames}" "${sample_seconds}"
    write_result "${index}" "${source}" true "${elapsed_ms}" \
        "${decoded_frames}" 'camera source passed startup and sustained decode checks'
}

probe_pids=()
camera_index=0
for source in "$@"; do
    camera_index=$((camera_index + 1))
    probe_source "${camera_index}" "${source}" &
    probe_pids+=("$!")
done

failed=0
for probe_pid in "${probe_pids[@]}"; do
    if ! wait "${probe_pid}"; then
        failed=1
    fi
done

if [[ -n "${report_file}" ]]; then
    report_tmp="$(mktemp "${report_file}.tmp.XXXXXX")"
    container_image="$(docker container inspect \
        --format '{{.Config.Image}}' "${container}")"
    container_image_id="$(docker container inspect \
        --format '{{.Image}}' "${container}")"
    generated_at="$(date -u +'%Y-%m-%dT%H:%M:%SZ')"
    if (( failed == 0 )); then
        report_passed=true
    else
        report_passed=false
    fi

    {
        printf '{\n'
        printf '  "generated_at":"%s",\n' "$(json_escape "${generated_at}")"
        printf '  "container":"%s",\n' "$(json_escape "${container}")"
        printf '  "container_image":"%s",\n' "$(json_escape "${container_image}")"
        printf '  "container_image_id":"%s",\n' "$(json_escape "${container_image_id}")"
        printf '  "base_url":"%s",\n' \
            "$(json_escape "$(redact_source "${base_url}")")"
        printf '  "hardware_verification_enabled":%s,\n' "${verify_hardware}"
        printf '  "required_hardware_backends":['
        for ((index = 0; index < ${#hardware_backends[@]}; index++)); do
            if (( index > 0 )); then
                printf ','
            fi
            printf '"%s"' "$(json_escape "${hardware_backends[index]}")"
        done
        printf '],\n'
        printf '  "max_first_frame_ms":%s,\n' "${max_first_frame_ms}"
        printf '  "sample_seconds":%s,\n' "${sample_seconds}"
        printf '  "min_sample_fps":%s,\n' "${min_sample_fps}"
        printf '  "camera_count":%s,\n' "${camera_index}"
        printf '  "passed":%s,\n' "${report_passed}"
        printf '  "cameras":[\n'
        for ((index = 1; index <= camera_index; index++)); do
            if (( index > 1 )); then
                printf ',\n'
            fi
            printf '    '
            cat "${result_dir}/${index}.json"
        done
        printf '  ]\n}\n'
    } >"${report_tmp}"
    mv -- "${report_tmp}" "${report_file}"
    report_tmp=""
    printf 'Wrote acceptance report to %s.\n' "${report_file}"
fi

if (( failed != 0 )); then
    printf '%s\n' 'Deployment camera acceptance failed.' >&2
    exit 1
fi

printf 'Validated %s camera source(s) concurrently below %sms first-frame readback.\n' \
    "${camera_index}" "${max_first_frame_ms}"
printf 'Each source also sustained at least %s FPS for %ss.\n' \
    "${min_sample_fps}" "${sample_seconds}"
printf '%s\n' 'Deployment camera acceptance passed.'
