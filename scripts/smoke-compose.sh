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
fallback_log=''

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

MSYS_NO_PATHCONV=1 docker run --rm --entrypoint /bin/sh "${restreamer_image}" -c '
    for binary in /core/bin/core /core/bin/import /core/bin/ffmigrate; do
        test -f "${binary}" && test -x "${binary}" || exit 1
    done
'
printf '%s\n' 'Validated executable Core application binaries.'

cleanup() {
    status=$?
    trap - EXIT
    if [[ -n "${acceptance_report}" ]]; then
        rm -f -- "${acceptance_report}"
    fi
    if [[ -n "${fallback_log}" ]]; then
        rm -f -- "${fallback_log}"
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

about_json=$(curl --fail --silent --show-error http://127.0.0.1:8080/api)
if [[ -n "${SMOKE_EXPECTED_COMMIT:-}" ]]; then
    grep -F "\"repository_commit\":\"${SMOKE_EXPECTED_COMMIT}\"" \
        <<<"${about_json}" >/dev/null
fi
if [[ -n "${SMOKE_EXPECTED_BRANCH:-}" ]]; then
    grep -F "\"repository_branch\":\"${SMOKE_EXPECTED_BRANCH}\"" \
        <<<"${about_json}" >/dev/null
fi
if [[ -n "${SMOKE_EXPECTED_BUILD_DATE:-}" ]]; then
    grep -F "\"build_date\":\"${SMOKE_EXPECTED_BUILD_DATE}\"" \
        <<<"${about_json}" >/dev/null
fi
if [[ -n "${SMOKE_EXPECTED_COMMIT:-}${SMOKE_EXPECTED_BRANCH:-}${SMOKE_EXPECTED_BUILD_DATE:-}" ]]; then
    printf '%s\n' 'Validated embedded Restreamer build identity.'
fi

image_id=$(docker container inspect restreamer --format '{{.Image}}')
image_source=$(docker image inspect "${image_id}" \
    --format '{{index .Config.Labels "org.opencontainers.image.source"}}')
[[ "${image_source}" == 'https://github.com/kaibsora/restreamer' ]]
if [[ -n "${SMOKE_EXPECTED_COMMIT:-}" ]]; then
    image_revision=$(docker image inspect "${image_id}" \
        --format '{{index .Config.Labels "org.opencontainers.image.revision"}}')
    image_version=$(docker image inspect "${image_id}" \
        --format '{{index .Config.Labels "org.opencontainers.image.version"}}')
    [[ "${image_revision}" == "${SMOKE_EXPECTED_COMMIT}" ]]
    [[ "${image_version}" == "${SMOKE_EXPECTED_COMMIT}" ]]
fi
if [[ -n "${SMOKE_EXPECTED_BRANCH:-}" ]]; then
    image_branch=$(docker image inspect "${image_id}" \
        --format '{{index .Config.Labels "io.restreamer.repository.branch"}}')
    [[ "${image_branch}" == "${SMOKE_EXPECTED_BRANCH}" ]]
fi
printf '%s\n' 'Validated Restreamer OCI image identity.'

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
    process_id=${3:-${api_process_id}}

    for _ in $(seq 1 20); do
        process_state=$(curl --fail --silent --show-error \
            "http://127.0.0.1:8080/api/v3/process/${process_id}/state")
        if grep -F "\"order\":\"${expected_order}\"" <<<"${process_state}" >/dev/null &&
            grep -F "\"exec\":\"${expected_exec}\"" <<<"${process_state}" >/dev/null; then
            return 0
        fi
        sleep 0.25
    done

    printf 'API process %s did not reach order=%s exec=%s. Last state: %s\n' \
        "${process_id}" "${expected_order}" "${expected_exec}" \
        "${process_state}" >&2
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

srt_process_id='restreamer-smoke:srt-relay'
srt_relay_path='ci-srt'
curl --fail --silent --show-error \
    --request POST \
    --header 'Content-Type: application/json' \
    --data @- \
    http://127.0.0.1:8080/api/v3/process >/dev/null <<'JSON'
{
  "id": "restreamer-smoke:srt-relay",
  "type": "ffmpeg",
  "reference": "restreamer-smoke:srt-relay",
  "input": [{
    "id": "srt",
    "address": "{srt,name=ci-srt.stream,mode=request}",
    "options": [
      "-fflags", "nobuffer",
      "-flags", "low_delay",
      "-analyzeduration", "0",
      "-probesize", "32"
    ]
  }],
  "output": [{
    "id": "rtsp",
    "address": "rtsp://mediamtx:8554/ci-srt",
    "options": [
      "-map", "0:v:0",
      "-c:v", "copy",
      "-f", "rtsp",
      "-rtsp_transport", "tcp",
      "-muxdelay", "0"
    ]
  }],
  "autostart": true,
  "reconnect": true,
  "reconnect_delay_seconds": 1,
  "stale_timeout_seconds": 10
}
JSON

docker exec --detach restreamer \
    ffmpeg -hide_banner -loglevel error -re \
    -f lavfi -i "testsrc2=size=320x180:rate=15" \
    -an -c:v libx264 -preset ultrafast -tune zerolatency \
    -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
    -f mpegts \
    "srt://127.0.0.1:6000?mode=caller&transtype=live&latency=20000&streamid=ci-srt.stream,mode:publish"

srt_publisher_ready=false
for _ in $(seq 1 20); do
    if curl --fail --silent --show-error http://127.0.0.1:8080/api/v3/srt \
        | grep -F 'ci-srt.stream' >/dev/null; then
        srt_publisher_ready=true
        break
    fi
    sleep 0.5
done
if [[ "${srt_publisher_ready}" != true ]]; then
    printf '%s\n' 'Core did not expose the synthetic SRT publisher.' >&2
    exit 1
fi
wait_for_process_state start running "${srt_process_id}"
printf '%s\n' 'Validated an SRT publisher through the Core media server.'

snapshot_source_process_id='restreamer-smoke:snapshot-source'
curl --fail --silent --show-error \
    --request POST \
    --header 'Content-Type: application/json' \
    --data @- \
    http://127.0.0.1:8080/api/v3/process >/dev/null <<'JSON'
{
  "id": "restreamer-smoke:snapshot-source",
  "type": "ffmpeg",
  "reference": "restreamer-smoke:snapshot-source",
  "input": [{
    "id": "lavfi",
    "address": "testsrc2=size=320x180:rate=15",
    "options": ["-re", "-f", "lavfi"]
  }],
  "output": [{
    "id": "hls",
    "address": "{memfs}/ci-snapshot-source.m3u8",
    "options": [
      "-c:v", "libx264",
      "-preset", "ultrafast",
      "-tune", "zerolatency",
      "-g", "15",
      "-f", "hls",
      "-hls_time", "1",
      "-hls_list_size", "3",
      "-hls_segment_filename", "{memfs}/ci-snapshot-source_%03d.ts",
      "-method", "PUT"
    ],
    "cleanup": [{
      "pattern": "memfs:/ci-snapshot-source*",
      "purge_on_delete": true
    }]
  }],
  "autostart": true,
  "reconnect": true,
  "reconnect_delay_seconds": 1,
  "stale_timeout_seconds": 10
}
JSON

snapshot_source_ready=false
for _ in $(seq 1 30); do
    if curl --fail --silent \
        http://127.0.0.1:8080/memfs/ci-snapshot-source.m3u8 \
        | grep -F '#EXTM3U' >/dev/null; then
        snapshot_source_ready=true
        break
    fi
    sleep 0.5
done
if [[ "${snapshot_source_ready}" != true ]]; then
    printf '%s\n' 'The managed HLS source for snapshot validation was not ready.' >&2
    exit 1
fi

snapshot_process_id='restreamer-smoke:snapshot'
snapshot_path='ci-snapshot.jpg'
curl --fail --silent --show-error \
    --request POST \
    --header 'Content-Type: application/json' \
    --data @- \
    http://127.0.0.1:8080/api/v3/process >/dev/null <<'JSON'
{
  "id": "restreamer-smoke:snapshot",
  "type": "ffmpeg",
  "reference": "restreamer-smoke:snapshot",
  "input": [{
    "id": "hls",
    "address": "{memfs}/ci-snapshot-source.m3u8",
    "options": []
  }],
  "output": [{
    "id": "snapshot",
    "address": "{memfs}/ci-snapshot.jpg",
    "options": ["-vframes", "1", "-f", "image2", "-update", "1"],
    "cleanup": [{
      "pattern": "memfs:/ci-snapshot.jpg",
      "purge_on_delete": true
    }]
  }],
  "autostart": true,
  "reconnect": true,
  "reconnect_delay_seconds": 1,
  "stale_timeout_seconds": 30
}
JSON

snapshot_ready=false
snapshot_info=''
# Stream curl into the Linux container instead of redirecting its binary output
# to /dev/null. Windows curl exits 23 for that redirect under Git Bash.
for _ in $(seq 1 20); do
    if snapshot_info=$(curl --fail --silent \
        "http://127.0.0.1:8080/memfs/${snapshot_path}" \
        | docker exec --interactive restreamer \
            ffprobe -hide_banner -v error \
            -select_streams v:0 \
            -show_entries stream=codec_name,width,height \
            -of csv=p=0 pipe:0 2>/dev/null) &&
        grep -Fx 'mjpeg,320,180' <<<"${snapshot_info}" >/dev/null; then
        snapshot_ready=true
        break
    fi
    sleep 0.5
done
if [[ "${snapshot_ready}" != true ]]; then
    printf 'A valid snapshot was not available at /memfs/%s.\n' \
        "${snapshot_path}" >&2
    curl --fail --silent --show-error \
        "http://127.0.0.1:8080/api/v3/process/${snapshot_process_id}/report" \
        >&2 || true
    printf '\n' >&2
    exit 1
fi
curl --fail --silent --show-error --request DELETE \
    "http://127.0.0.1:8080/api/v3/process/${snapshot_process_id}" >/dev/null
curl --fail --silent --show-error --request DELETE \
    "http://127.0.0.1:8080/api/v3/process/${snapshot_source_process_id}" >/dev/null
if curl --fail --silent \
    "http://127.0.0.1:8080/memfs/${snapshot_path}" \
    | cat >/dev/null; then
    printf 'Snapshot cleanup left /memfs/%s behind.\n' \
        "${snapshot_path}" >&2
    exit 1
fi
printf '%s\n' 'Validated managed HLS snapshot creation, retrieval, and cleanup.'

fallback_path='resilient/16'
fallback_log="$(mktemp "${TMPDIR:-/tmp}/restreamer-fallback.XXXXXX.log")"
docker exec restreamer \
    timeout 15 ffmpeg -hide_banner -loglevel info \
    -rtsp_transport tcp -i "rtsp://mediamtx:8554/${fallback_path}" \
    -t 8 -an -vf showinfo -f null - >"${fallback_log}" 2>&1 &
fallback_reader_pid=$!

sleep 1
docker exec restreamer \
    ffmpeg -hide_banner -loglevel error -re \
    -f lavfi -i 'testsrc2=size=320x180:rate=15' -t 3 \
    -an -c:v libx264 -preset ultrafast -tune zerolatency \
    -g 15 -keyint_min 15 -sc_threshold 0 -bf 0 \
    -f rtsp -rtsp_transport tcp -muxdelay 0 -pkt_size 1200 \
    "rtsp://mediamtx:8554/${fallback_path}"

if ! wait "${fallback_reader_pid}"; then
    printf '%s\n' 'The resilient MediaMTX reader disconnected during a publisher transition.' >&2
    cat "${fallback_log}" >&2
    exit 1
fi
grep -F 's:1920x1080' "${fallback_log}" >/dev/null
grep -F 's:320x180' "${fallback_log}" >/dev/null
printf '%s\n' 'Validated one persistent reader across offline slate, live publisher, and offline recovery.'

for camera in $(seq 1 "${camera_count}"); do
    docker exec --detach restreamer \
        ffmpeg -hide_banner -loglevel error -re \
        -f lavfi -i "testsrc2=size=320x180:rate=15" \
        -an -c:v libx264 -preset ultrafast -tune zerolatency \
        -g 1 -keyint_min 1 -sc_threshold 0 -bf 0 \
        -f rtsp -rtsp_transport tcp -muxdelay 0 -pkt_size 1200 \
        "rtsp://mediamtx:8554/ci-camera-${camera}"
done

relay_paths=("${srt_relay_path}")
for camera in $(seq 1 "${camera_count}"); do
    relay_paths+=("ci-camera-${camera}")
done

probe_relay_path() {
    relay_path=$1
    stream_info=''

    for _ in $(seq 1 15); do
        if stream_info=$(docker exec restreamer \
            ffprobe -hide_banner -v error -rtsp_transport tcp \
            -select_streams v:0 \
            -show_entries stream=codec_name,width,height,r_frame_rate \
            -of default=noprint_wrappers=1 \
            "rtsp://mediamtx:8554/${relay_path}" 2>/dev/null); then
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
for relay_path in "${relay_paths[@]}"; do
    probe_relay_path "${relay_path}" &
    probe_pids+=("$!")
done
for probe_pid in "${probe_pids[@]}"; do
    wait "${probe_pid}"
done

read_first_frame() {
    relay_path=$1
    started_ms=$(date +%s%3N)

    if ! read_error=$(docker exec restreamer \
        timeout 5 ffmpeg -hide_banner -loglevel error \
            -rtsp_transport tcp -fflags nobuffer -flags low_delay -avioflags direct \
            -analyzeduration 0 -probesize 32 \
            -i "rtsp://mediamtx:8554/${relay_path}" \
            -map 0:v:0 -frames:v 1 -f null - 2>&1 >/dev/null); then
        printf 'Relay %s did not produce a decoded frame:\n%s\n' \
            "${relay_path}" "${read_error}" >&2
        return 1
    fi

    finished_ms=$(date +%s%3N)
    elapsed_ms=$((finished_ms - started_ms))
    if (( elapsed_ms >= max_first_frame_ms )); then
        printf 'Relay %s first-frame readback took %sms (limit: %sms).\n' \
            "${relay_path}" "${elapsed_ms}" "${max_first_frame_ms}" >&2
        return 1
    fi

    printf 'Relay %s first-frame readback: %sms\n' "${relay_path}" "${elapsed_ms}"
}

read_pids=()
for relay_path in "${relay_paths[@]}"; do
    read_first_frame "${relay_path}" &
    read_pids+=("$!")
done
for read_pid in "${read_pids[@]}"; do
    wait "${read_pid}"
done

acceptance_report="$(mktemp "${TMPDIR:-/tmp}/restreamer-acceptance.XXXXXX.json")"

ACCEPT_MAX_FIRST_FRAME_MS="${max_first_frame_ms}" \
ACCEPT_SAMPLE_SECONDS="${accept_sample_seconds}" \
ACCEPT_MIN_SAMPLE_FPS=10 \
ACCEPT_RELAY_REPORT_FILE="${acceptance_report}" \
    scripts/accept-relays.sh "${relay_paths[@]}"

grep -F '"passed":true' "${acceptance_report}" >/dev/null
grep -F "\"camera_count\":${#relay_paths[@]}" "${acceptance_report}" >/dev/null
grep -F '"decoded_frames":' "${acceptance_report}" >/dev/null
grep -F '"required_hardware_backends":[]' "${acceptance_report}" >/dev/null
grep -F '"container_repo_digests":' "${acceptance_report}" >/dev/null
grep -F '"container_labels":' "${acceptance_report}" >/dev/null
if [[ -n "${SMOKE_EXPECTED_COMMIT:-}" ]]; then
    grep -F "\"org.opencontainers.image.revision\":\"${SMOKE_EXPECTED_COMMIT}\"" \
        "${acceptance_report}" >/dev/null
fi
if [[ -n "${SMOKE_EXPECTED_BRANCH:-}" ]]; then
    grep -F "\"io.restreamer.repository.branch\":\"${SMOKE_EXPECTED_BRANCH}\"" \
        "${acceptance_report}" >/dev/null
fi

printf 'Validated %s concurrent RTSP/WHEP paths, including SRT ingest, below %sms first-frame readback.\n' \
    "${#relay_paths[@]}" "${max_first_frame_ms}"
printf '%s\n' 'Unified Restreamer + MediaMTX camera-stack smoke test passed.'
