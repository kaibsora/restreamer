#!/bin/sh
set -eu

fail() {
    printf 'FFmpeg hardware verification failed: %s\n' "$1" >&2
    exit 1
}

require_fixed_line() {
    output=$1
    expected=$2
    printf '%s\n' "$output" | grep -F -x -- "$expected" >/dev/null || fail "missing ${expected}"
}

require_pattern() {
    output=$1
    expected=$2
    printf '%s\n' "$output" | grep -E -- "$expected" >/dev/null || fail "missing pattern ${expected}"
}

ffmpeg_version=$(ffmpeg -hide_banner -version 2>&1)
ffprobe_version=$(ffprobe -hide_banner -version 2>&1)
license=$(ffmpeg -hide_banner -L 2>&1)
hwaccels=$(ffmpeg -hide_banner -hwaccels 2>&1)
encoders=$(ffmpeg -hide_banner -encoders 2>&1)
filters=$(ffmpeg -hide_banner -filters 2>&1)
muxers=$(ffmpeg -hide_banner -muxers 2>&1)
output_protocols=$(ffmpeg -hide_banner -protocols 2>&1 | sed -n '/^Output:/,$p')
full_help=$(ffmpeg -hide_banner -h full 2>&1)
hls_help=$(ffmpeg -hide_banner -h muxer=hls 2>&1)
rtp_mpegts_help=$(ffmpeg -hide_banner -h muxer=rtp_mpegts 2>&1)

require_pattern "$ffmpeg_version" '^ffmpeg version [0-9]'
require_pattern "$ffprobe_version" '^ffprobe version [0-9]'

if printf '%s\n' "$license" | grep -F -i -- 'unredistributable' >/dev/null; then
    fail 'binary is marked unredistributable'
fi
require_pattern "$license" 'GNU General Public License'

case "${RESTREAMER_FFMPEG_PROFILE:-desktop}" in
  desktop) accelerators='cuda vaapi qsv drm vulkan'; backends='nvenc qsv vaapi vulkan' ;;
  raspberrypi) accelerators='drm'; backends='v4l2m2m' ;;
  *) fail 'unknown hardware build profile' ;;
esac
for accelerator in $accelerators; do
    require_fixed_line "$hwaccels" "$accelerator"
done

for codec in av1 h264 hevc; do
    for backend in $backends; do
        [ "$backend" != v4l2m2m ] || [ "$codec" = h264 ] || continue
        require_pattern "$encoders" "[[:space:]]${codec}_${backend}[[:space:]]"
    done
done
require_pattern "$encoders" '[[:space:]]aac[[:space:]]+AAC'

if [ "${RESTREAMER_FFMPEG_PROFILE:-desktop}" = desktop ]; then
    for filter in overlay_vulkan scale_vulkan transpose_vulkan; do
        require_pattern "$filters" "[[:space:]]${filter}[[:space:]]"
    done
else
    # The Pi build must not silently acquire desktop GPU dependencies.
    if printf '%s\n' "$hwaccels" | grep -Ex 'cuda|qsv|vaapi|vulkan' >/dev/null; then
        fail 'desktop GPU API present in Raspberry Pi profile'
    fi
fi
for filter in movie overlay scale format transpose hflip vflip colorchannelmixer setpts drawtext aresample; do
    require_pattern "$filters" "[[:space:]]${filter}[[:space:]]"
done

# Prove that the runtime resampler can compensate a drifting live clock. Merely
# listing aresample is not enough: a broken libswresample linkage can still leave
# us with a very confidently advertised checkbox that does nothing.
audio_clock_test=$(mktemp -d)
trap 'rm -rf "$audio_clock_test"' EXIT HUP INT TERM
ffmpeg -hide_banner -loglevel error \
    -f lavfi -i 'sine=frequency=1000:sample_rate=48000:duration=10' \
    -af 'asetpts=PTS*1.01,aresample=async=1000:first_pts=0' \
    -c:a pcm_s16le "$audio_clock_test/compensated.wav" 2>/dev/null
audio_clock_duration=$(ffprobe -v error -show_entries format=duration \
    -of default=nw=1:nk=1 "$audio_clock_test/compensated.wav")
awk -v duration="$audio_clock_duration" \
    'BEGIN { exit !(duration > 10.05 && duration < 10.15) }' || \
    fail "aresample clock compensation produced ${audio_clock_duration}s instead of approximately 10.09s"
rm -rf "$audio_clock_test"
trap - EXIT HUP INT TERM

test -r /usr/share/fonts/truetype/dejavu/DejaVuSans.ttf || fail 'missing DejaVu Sans runtime font'

require_pattern "$muxers" '[[:space:]]E[[:space:]]+rtp_mpegts[[:space:]]'
require_fixed_line "$output_protocols" '  rtp'
require_pattern "$rtp_mpegts_help" 'RTP/mpegts output format'

require_pattern "$full_help" '^-jsonstats[[:space:]]'
require_pattern "$hls_help" '[[:space:]]adjust_sequence[[:space:]]'

printf '%s\n' "FFmpeg hardware verification passed: $(printf '%s\n' "$ffmpeg_version" | sed -n '1p')"
