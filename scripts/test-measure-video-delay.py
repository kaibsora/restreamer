#!/usr/bin/env python3
"""Regression checks for corrupted markers, rollover and reader cleanup."""
import importlib.util
from pathlib import Path
import subprocess
import sys
import time
import unittest

spec = importlib.util.spec_from_file_location('delay', Path(__file__).with_name('measure-video-delay.py'))
delay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(delay)


def frame(stamp):
    values = [(165, 8), (stamp, 32), (stamp % 251, 8)]
    return bytes(255 if number & (1 << bit) else 0 for number, count in values for bit in range(count))


class MarkerTests(unittest.TestCase):
    def test_decode_and_rollover_boundaries(self):
        for stamp in [0, 1, 250, 251, 2**31, 2**32 - 1]:
            self.assertEqual(delay.decode_marker(frame(stamp)), stamp)

    def test_corruption_and_unmarked_video_are_rejected(self):
        marked = bytearray(frame(123456))
        marked[12] = 255 - marked[12]
        self.assertIsNone(delay.decode_marker(marked))
        self.assertIsNone(delay.decode_marker(bytes(48)))
        self.assertIsNone(delay.decode_marker(bytes(47)))

    def test_reader_is_terminated_after_bounded_sampling(self):
        stamp = int(time.time() * 1000) % 2**32
        child = ('import sys,time; sys.stdout.buffer.write(bytes.fromhex("'
                 + frame(stamp).hex() + '")); sys.stdout.buffer.flush(); time.sleep(60)')
        start = time.monotonic()
        result = delay.measure([sys.executable, '-c', child], .1, 2, 0)
        self.assertEqual(result['frames'], 1)
        self.assertLess(time.monotonic() - start, 4)

    def test_unmarked_source_fails_instead_of_reporting_a_latency(self):
        child = 'import sys; sys.stdout.buffer.write(bytes(48))'
        with self.assertRaisesRegex(RuntimeError, 'No valid timestamp'):
            delay.measure([sys.executable, '-c', child], .1, 2, 0)


if __name__ == '__main__':
    unittest.main()
