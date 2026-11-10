#!/usr/bin/env sh
set -eu

work_dir=$(mktemp -d /tmp/restreamer-hevc-hls.XXXXXX)
cleanup() {
    status=$?
    trap - 0 1 2 15
    case "${work_dir}" in
        /tmp/restreamer-hevc-hls.*) ;;
        *)
            printf 'Refusing to clean unexpected path %s.\n' "${work_dir}" >&2
            exit 1
            ;;
    esac
    rm -f -- "${work_dir}"/*
    rmdir -- "${work_dir}"
    exit "${status}"
}
trap cleanup 0
trap 'exit 129' 1
trap 'exit 130' 2
trap 'exit 143' 15

ffmpeg -hide_banner -loglevel error \
    -f lavfi -i 'testsrc2=size=64x64:rate=2' \
    -map 0:v:0 -frames:v 2 -an \
    -codec:v libx265 -preset:v ultrafast \
    -x265-params 'log-level=error:pools=none:frame-threads=1' \
    -tag:v hvc1 -f tee \
    "[f=hls:hls_time=1:hls_list_size=0:hls_segment_type=fmp4:hls_fmp4_init_filename=init.mp4:hls_segment_filename=${work_dir}/segment-%d.m4s]${work_dir}/index.m3u8|[f=mpegts]${work_dir}/relay.ts"

codec_tag=$(ffprobe -v error \
    -select_streams v:0 \
    -show_entries stream=codec_name,codec_tag_string \
    -of csv=p=0 \
    "${work_dir}/init.mp4")

if [ "${codec_tag}" != 'hevc,hvc1' ]; then
    printf 'Expected HEVC fMP4 codec tag hevc,hvc1, got %s.\n' \
        "${codec_tag}" >&2
    exit 1
fi

ffmpeg -hide_banner -loglevel error \
    -i "${work_dir}/relay.ts" \
    -map 0:v:0 -frames:v 1 -f null -

printf '%s\n' 'Verified hvc1-tagged HEVC fMP4 HLS and decodable MPEG-TS tee output.'
