#!/usr/bin/env python3
"""Measure a timestamp-marked video pipeline; never measures optical latency.

Use --print-filter in a temporary publisher after assigning wall-clock input
timestamps (-copyts -use_wallclock_as_timestamps 1). Apply setpts=PTS-STARTPTS
AFTER the marker, and then your chosen pixel conversion/hardware upload/encoder.
The first 384x8 pixels are replaced by a timestamp, magic byte and checksum.
The camera, input, encoder and relay configuration are deliberately external.
Container/remote launchers need their own timeout as well (for example,
docker exec CONTAINER timeout 45 ffmpeg); terminating a local launcher does not
guarantee that its remote child terminates.
"""
import argparse
import json
import math
import queue
import statistics
import subprocess
import threading
import time

MODULUS = 2**32
CELLS = 48
CELL_SIZE = 8


def marker_filter():
    expressions = [str(165)] * 8 + ['floor(t*1000)'] * 32 + [
        'mod(mod(floor(t*1000),4294967296),251)'
    ] * 8
    bits = list(range(8)) + list(range(32)) + list(range(8))
    filters = ['drawbox=x=0:y=0:w=384:h=8:color=black:t=fill']
    for cell, (expression, bit) in enumerate(zip(expressions, bits)):
        filters.append(
            f"drawbox=x={cell*CELL_SIZE}:y=0:w=8:h=8:color=white:t=fill:"
            f"enable='bitand({expression},{2**bit})'"
        )
    return ','.join(filters)


def decode_marker(frame):
    values = [int(value > 128) for value in frame]
    if len(values) != CELLS:
        return None
    number = lambda start, count: sum(values[start + bit] << bit for bit in range(count))
    stamp = number(8, 32)
    if number(0, 8) != 165 or number(40, 8) != stamp % 251:
        return None
    return stamp


def percentile(values, fraction):
    return sorted(values)[max(0, math.ceil(len(values) * fraction) - 1)]


def measure(command, duration, startup_timeout, offset_ms):
    # No shell, bounded subprocess, continuously drained stderr, and a finally
    # cleanup even on timeout, invalid video or interruption.
    process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    samples = queue.Queue()

    def read_frames():
        while True:
            frame = bytearray()
            while len(frame) < CELLS:
                data = process.stdout.read(CELLS - len(frame))
                if not data:
                    samples.put(None)
                    return
                frame.extend(data)
            samples.put((time.time() * 1000 + offset_ms, time.monotonic(), bytes(frame)))

    def drain_errors():
        for _ in process.stderr:
            # Do not report FFmpeg diagnostics: URLs may contain credentials.
            pass

    started = time.monotonic()
    threads = [threading.Thread(target=read_frames, daemon=True), threading.Thread(target=drain_errors, daemon=True)]
    for thread in threads:
        thread.start()
    ages = []
    first = None
    invalid = 0
    try:
        while True:
            deadline = started + startup_timeout if first is None else first + duration
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                break
            try:
                sample = samples.get(timeout=remaining)
            except queue.Empty:
                break
            if sample is None:
                break
            wall_ms, received, frame = sample
            stamp = decode_marker(frame)
            if stamp is None:
                invalid += 1
                continue
            if first is None:
                first = received
            # Signed modular difference supports timestamp rollover and makes
            # negative ages from unsynchronized clocks visible rather than huge.
            age = ((wall_ms - stamp + MODULUS / 2) % MODULUS) - MODULUS / 2
            ages.append(age)
    finally:
        if process.poll() is None:
            process.terminate()
            try:
                process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=3)
        for thread in threads:
            thread.join(timeout=1)
        process.stdout.close()
        process.stderr.close()
    if not ages:
        raise RuntimeError('No valid timestamp-marked frames arrived before the timeout.')
    elapsed = max(0.001, time.monotonic() - first)
    return {
        'measurement': 'software-input-timestamp-to-decoder; excludes optical sensor/display delay',
        'first_frame_ms': round((first - started) * 1000, 1),
        'frames': len(ages), 'invalid_markers': invalid,
        'sample_seconds': round(elapsed, 2),
        'age_ms': {name: round(value, 1) for name, value in {
            'min': min(ages), 'median': statistics.median(ages),
            'p95': percentile(ages, .95), 'max': max(ages),
            'first_half_median': statistics.median(ages[:max(1, len(ages)//2)]),
            'last_half_median': statistics.median(ages[len(ages)//2:]),
        }.items()},
        'clock_offset_ms': offset_ms,
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--print-filter', action='store_true')
    parser.add_argument('--url')
    parser.add_argument('--ffmpeg-prefix-json', default='["ffmpeg"]', help='Executable and optional launcher arguments, as a JSON array; remote launchers must enforce their own timeout')
    parser.add_argument('--rtsp-transport', choices=['tcp', 'udp'], default='tcp')
    parser.add_argument('--seconds', type=float, default=10)
    parser.add_argument('--startup-timeout', type=float, default=30)
    parser.add_argument('--min-frames', type=int, default=10, help='Required valid frames during the sample window')
    parser.add_argument('--clock-offset-ms', type=float, default=0, help='Publisher clock minus reader clock; synchronize/calibrate remote hosts first')
    parser.add_argument('--clock-uncertainty-ms', type=float, default=0, help='Bound on clock calibration error; included in the p95 acceptance bound')
    parser.add_argument('--max-age-ms', type=float, default=1000, help='Require p95 plus clock uncertainty below this bound')
    args = parser.parse_args()
    if args.print_filter:
        print(marker_filter())
        return
    if (not args.url or min(args.seconds, args.startup_timeout, args.max_age_ms) <= 0
            or not all(math.isfinite(value) for value in [args.seconds, args.startup_timeout, args.max_age_ms, args.clock_offset_ms, args.clock_uncertainty_ms])
            or args.clock_uncertainty_ms < 0 or args.min_frames < 1):
        parser.error('URL and positive time/age bounds are required')
    prefix = json.loads(args.ffmpeg_prefix_json)
    if not isinstance(prefix, list) or not prefix or not all(isinstance(value, str) for value in prefix):
        parser.error('FFmpeg prefix must be a nonempty JSON array of strings')
    options = ['-fflags', 'nobuffer', '-flags', 'low_delay', '-analyzeduration', '0', '-probesize', '32768']
    if args.url.startswith(('rtsp://', 'rtsps://')):
        options += ['-rtsp_transport', args.rtsp_transport, '-max_delay', '0']
    elif args.url.startswith(('rtmp://', 'rtmps://')):
        options += ['-rtmp_live', 'live', '-rtmp_buffer', '0']
    else:
        parser.error('Expected an RTSP(S) or RTMP(S) source')
    command = prefix + ['-hide_banner', '-loglevel', 'error', '-nostdin'] + options + [
        '-i', args.url, '-map', '0:v:0', '-an', '-vf',
        'crop=384:8:0:0,scale=48:1:flags=neighbor,format=gray',
        '-fps_mode', 'passthrough', '-f', 'rawvideo', 'pipe:1',
    ]
    try:
        result = measure(command, args.seconds, args.startup_timeout, args.clock_offset_ms)
    except (RuntimeError, OSError) as error:
        # Avoid echoing source URLs or command lines in errors.
        print(json.dumps({'passed': False, 'error': str(error) if isinstance(error, RuntimeError) else 'Could not launch the configured decoder'}))
        raise SystemExit(1)
    result['clock_uncertainty_ms'] = args.clock_uncertainty_ms
    result['p95_upper_bound_ms'] = round(result['age_ms']['p95'] + args.clock_uncertainty_ms, 1)
    result['passed'] = (result['age_ms']['min'] >= -args.clock_uncertainty_ms
                        and result['p95_upper_bound_ms'] < args.max_age_ms
                        and result['frames'] >= args.min_frames
                        and result['sample_seconds'] >= .9 * args.seconds)
    print(json.dumps(result))
    raise SystemExit(0 if result['passed'] else 1)


if __name__ == '__main__':
    main()
