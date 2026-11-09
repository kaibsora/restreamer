#!/usr/bin/env bash
set -euo pipefail

project_name="${COMPOSE_PROJECT_NAME:-restreamer-integration-smoke}"
restreamer_image="${RESTREAMER_IMAGE:-restreamer-smoke:local}"
camera_count="${SMOKE_CAMERA_COUNT:-4}"
max_first_frame_ms="${SMOKE_MAX_FIRST_FRAME_MS:-1000}"
accept_sample_seconds="${SMOKE_ACCEPT_SAMPLE_SECONDS:-2}"
compose=(
    docker compose
    --project-name "${project_name}"
    --file deploy/compose.yaml
    --file deploy/compose.smoke.yaml
)
acceptance_report=''

if [[ ! "${camera_count}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'SMOKE_CAMERA_COUNT must be a positive integer, got %q.\n' "${camera_count}" >&2
    exit 1
fi

if [[ ! "${max_first_frame_ms}" =~ ^[1-9][0-9]*$ ]]; then
    printf 'SMOKE_MAX_FIRST_FRAME_MS must be a positive integer, got %q.\n' "${max_first_frame_ms}" >&2
    exit 1
fi

if docker container inspect restreamer >/dev/null 2>&1 ||
    docker container inspect restreamer-mediamtx >/dev/null 2>&1; then
    printf '%s\n' 'Refusing to replace an existing restreamer smoke-test container.' >&2
    exit 1
fi

cleanup() {
    status=$?
    trap - EXIT
    if [[ -n "${acceptance_report}" ]]; then
        rm -f -- "${acceptance_report}"
    fi
    if [[ ${status} -ne 0 ]]; then
        "${compose[@]}" logs --no-color --tail 100 || true
    fi
    "${compose[@]}" down --volumes --remove-orphans >/dev/null 2>&1 || true
    exit "${status}"
}
trap cleanup EXIT

export RESTREAMER_IMAGE="${restreamer_image}"
export RESTREAMER_WEBRTC_HOSTS="${RESTREAMER_WEBRTC_HOSTS:-127.0.0.1}"

"${compose[@]}" up --detach

ready=false
for _ in $(seq 1 30); do
    if curl --fail --silent http://127.0.0.1:8080/api >/dev/null; then
        ready=true
        break
    fi
    sleep 1
done
[[ "${ready}" == "true" ]]

health_status='starting'
for _ in $(seq 1 20); do
    health_status=$(docker container inspect restreamer \
        --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}')
    if [[ "${health_status}" == 'healthy' ]]; then
        break
    fi
    if [[ "${health_status}" == 'unhealthy' || "${health_status}" == 'missing' ]]; then
        break
    fi
    sleep 1
done
if [[ "${health_status}" != 'healthy' ]]; then
    printf 'Restreamer container health is %s, expected healthy.\n' \
        "${health_status}" >&2
    exit 1
fi
docker exec restreamer restreamer-healthcheck
printf '%s\n' 'Validated the built-in Restreamer container health check.'

for path in / /ui/ /api; do
    curl --fail --silent --show-error "http://127.0.0.1:8080${path}" >/dev/null
done

skills_json=$(curl --fail --silent --show-error http://127.0.0.1:8080/api/v3/skills)
grep -F '/dev/video99' <<<"${skills_json}" >/dev/null
printf '%s\n' 'Validated fallback discovery for a container-mapped V4L2 device.'

ui_html=$(curl --fail --silent --show-error http://127.0.0.1:8080/ui/)
grep -F '<title>Restreamer</title>' <<<"${ui_html}" >/dev/null

overlay_plugin=$(curl --fail --silent --show-error \
    http://127.0.0.1:8080/ui/_player/videojs/dist/videojs-overlay.min.js)
grep -F '@version 3.1.0' <<<"${overlay_plugin}" >/dev/null
printf '%s\n' 'Validated the Video.js 8-compatible public logo overlay plugin.'

while read -r relative_asset; do
    asset_path="${relative_asset#./}"
    content_type=$(curl --fail --silent --show-error \
        --output /dev/null --write-out '%{content_type}' \
        "http://127.0.0.1:8080/ui/${asset_path}")
    if [[ "${content_type}" == text/html* ]]; then
        printf 'UI asset %s resolved to HTML instead of an asset.\n' \
            "${relative_asset}" >&2
        exit 1
    fi
done < <(
    grep -oE '(src|href)="\./[^"#]+"' <<<"${ui_html}" \
        | sed -E 's/^(src|href)="|"$//g' \
        | awk '!seen[$0]++'
)

dynamic_asset_count=0
while read -r container_asset; do
    relative_asset="${container_asset#/core/ui/}"
    content_type=$(curl --fail --silent --show-error \
        --output /dev/null --write-out '%{content_type}' \
        "http://127.0.0.1:8080/ui/${relative_asset}")
    if [[ "${content_type}" == text/html* ]]; then
        printf 'Dynamic UI asset %s resolved to HTML instead of an asset.\n' \
            "${relative_asset}" >&2
        exit 1
    fi
    dynamic_asset_count=$((dynamic_asset_count + 1))
done < <(
    MSYS_NO_PATHCONV=1 docker exec restreamer find /core/ui/assets -type f \
        \( -name '*.js' -o -name '*.css' \)
)

if (( dynamic_asset_count < 20 )); then
    printf 'Expected split UI assets, found only %s JavaScript/CSS files.\n' \
        "${dynamic_asset_count}" >&2
    exit 1
fi

ui_redirect_html=$(curl --fail --location --silent --show-error \
    http://127.0.0.1:8080/ui)
grep -F '<title>Restreamer</title>' <<<"${ui_redirect_html}" >/dev/null

docker exec restreamer restreamer-verify-ffmpeg

api_process_id='restreamer-smoke:api-control'
curl --fail --silent --show-error \
    --request POST \
    --header 'Content-Type: application/json' \
    --data @- \
    http://127.0.0.1:8080/api/v3/process >/dev/null <<'JSON'
{
  "id": "restreamer-smoke:api-control",
  "type": "ffmpeg",
  "input": [{
    "id": "video",
    "address": "testsrc2=size=160x90:rate=5",
    "options": ["-f", "lavfi", "-re"]
  }],
  "output": [{
    "id": "null",
    "address": "-",
    "options": ["-map", "0:v:0", "-c:v", "copy", "-f", "null"]
  }],
  "autostart": false,
  "reconnect": false
}
JSON

process_command() {
    command=$1
    curl --fail --silent --show-error \
        --request PUT \
        --header 'Content-Type: application/json' \
        --data "{\"command\":\"${command}\"}" \
        "http://127.0.0.1:8080/api/v3/process/${api_process_id}/command" \
        >/dev/null
}

wait_for_process_state() {
    expected_order=$1
    expected_exec=$2

    for _ in $(seq 1 20); do
        process_state=$(curl --fail --silent --show-error \
            "http://127.0.0.1:8080/api/v3/process/${api_process_id}/state")
        if grep -F "\"order\":\"${expected_order}\"" <<<"${process_state}" >/dev/null &&
            grep -F "\"exec\":\"${expected_exec}\"" <<<"${process_state}" >/dev/null; then
            return 0
        fi
        sleep 0.25
    done

    printf 'API process did not reach order=%s exec=%s. Last state: %s\n' \
        "${expected_order}" "${expected_exec}" "${process_state}" >&2
    return 1
}

process_command start
wait_for_process_state start running
process_command stop
wait_for_process_state stop finished
curl --fail --silent --show-error \
    --request DELETE \
    "http://127.0.0.1:8080/api/v3/process/${api_process_id}" >/dev/null
printf '%s\n' 'Validated API start and stop control for an FFmpeg process.'

for camera in $(seq 1 "${camera_count}"); do
    docker exec --detach restreamer \
        ffmpeg -hide_banner -loglevel error -re \
        -f lavfi -i "testsrc2=size=320x180:rate=15" \
        -an -c:v libx264 -preset ultrafast -tune zerolatency \
        -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
        -f rtsp -rtsp_transport tcp -muxdelay 0 -pkt_size 1200 \
        "rtsp://mediamtx:8554/ci-camera-${camera}"
done

probe_camera() {
    camera=$1
    stream_info=''

    for _ in $(seq 1 15); do
        if stream_info=$(docker exec restreamer \
            ffprobe -hide_banner -v error -rtsp_transport tcp \
            -select_streams v:0 \
            -show_entries stream=codec_name,width,height,r_frame_rate \
            -of default=noprint_wrappers=1 \
            "rtsp://mediamtx:8554/ci-camera-${camera}" 2>/dev/null); then
            break
        fi
        sleep 1
    done

    grep -Fx 'codec_name=h264' <<<"${stream_info}" >/dev/null
    grep -Fx 'width=320' <<<"${stream_info}" >/dev/null
    grep -Fx 'height=180' <<<"${stream_info}" >/dev/null
    grep -Fx 'r_frame_rate=15/1' <<<"${stream_info}" >/dev/null
}

probe_pids=()
for camera in $(seq 1 "${camera_count}"); do
    probe_camera "${camera}" &
    probe_pids+=("$!")
done
for probe_pid in "${probe_pids[@]}"; do
    wait "${probe_pid}"
done

read_first_frame() {
    camera=$1
    started_ms=$(date +%s%3N)

    if ! read_error=$(docker exec restreamer \
        timeout 5 ffmpeg -hide_banner -loglevel error \
            -rtsp_transport tcp -fflags nobuffer -flags low_delay -avioflags direct \
            -analyzeduration 0 -probesize 32 \
            -i "rtsp://mediamtx:8554/ci-camera-${camera}" \
            -map 0:v:0 -frames:v 1 -f null - 2>&1 >/dev/null); then
        printf 'Camera %s did not produce a decoded frame:\n%s\n' \
            "${camera}" "${read_error}" >&2
        return 1
    fi

    finished_ms=$(date +%s%3N)
    elapsed_ms=$((finished_ms - started_ms))
    if (( elapsed_ms >= max_first_frame_ms )); then
        printf 'Camera %s first-frame readback took %sms (limit: %sms).\n' \
            "${camera}" "${elapsed_ms}" "${max_first_frame_ms}" >&2
        return 1
    fi

    printf 'Camera %s first-frame readback: %sms\n' "${camera}" "${elapsed_ms}"
}

read_pids=()
for camera in $(seq 1 "${camera_count}"); do
    read_first_frame "${camera}" &
    read_pids+=("$!")
done
for read_pid in "${read_pids[@]}"; do
    wait "${read_pid}"
done

acceptance_report="$(mktemp "${TMPDIR:-/tmp}/restreamer-acceptance.XXXXXX.json")"
acceptance_paths=()
for camera in $(seq 1 "${camera_count}"); do
    acceptance_paths+=("ci-camera-${camera}")
done

ACCEPT_MAX_FIRST_FRAME_MS="${max_first_frame_ms}" \
ACCEPT_SAMPLE_SECONDS="${accept_sample_seconds}" \
ACCEPT_MIN_SAMPLE_FPS=10 \
ACCEPT_RELAY_REPORT_FILE="${acceptance_report}" \
    scripts/accept-relays.sh "${acceptance_paths[@]}"

grep -F '"passed":true' "${acceptance_report}" >/dev/null
grep -F "\"camera_count\":${camera_count}" "${acceptance_report}" >/dev/null
grep -F '"decoded_frames":' "${acceptance_report}" >/dev/null
grep -F '"required_hardware_backends":[]' "${acceptance_report}" >/dev/null

printf 'Validated %s concurrent RTSP camera paths and WebRTC endpoints below %sms first-frame readback.\n' \
    "${camera_count}" "${max_first_frame_ms}"
printf '%s\n' 'Unified Restreamer + MediaMTX camera-stack smoke test passed.'
