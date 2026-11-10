import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('video_hotplug', Path(__file__).with_name('video-hotplug.py'))
helper = importlib.util.module_from_spec(spec)
spec.loader.exec_module(helper)


class HotplugTests(unittest.TestCase):
    def test_unchanged_devices_need_no_docker_exec(self):
        state = {'devices': {'video0': {'major': 81, 'minor': 0, 'gid': 44}}, 'links': {'usb-camera-video-index0': 'video0'}}
        self.assertEqual(helper.plan(state, state), [])

    def test_replug_moves_stable_camera_alias_to_new_node(self):
        old = {'devices': {'video0': {'major': 81, 'minor': 0, 'gid': 44}}, 'links': {'usb-camera-video-index0': 'video0'}}
        new = {'devices': {'video2': {'major': 81, 'minor': 2, 'gid': 44}}, 'links': {'usb-camera-video-index0': 'video2'}}
        actions = helper.plan(old, new)
        self.assertIn(['rm', '-f', '--', '/dev/video0'], actions)
        self.assertIn(['ln', '-sfn', '../../video2', '/dev/v4l/by-id/usb-camera-video-index0'], actions)

    def test_only_managed_video_paths_can_be_removed(self):
        with self.assertRaises(ValueError):
            helper.plan({'devices': {'../sda': {}}}, {'devices': {}, 'links': {}})
        with self.assertRaises(ValueError):
            helper.plan({'links': {'../../../etc/passwd': ''}}, {'devices': {}, 'links': {}})

    def test_fast_replug_with_same_minor_refreshes_device_inode(self):
        old = {'devices': {'video0': {'major': 81, 'minor': 0, 'gid': 44, 'generation': '100:1'}}, 'links': {}}
        new = {'devices': {'video0': {'major': 81, 'minor': 0, 'gid': 44, 'generation': '101:2'}}, 'links': {}}
        self.assertIn(['rm', '-f', '--', '/dev/video0'], helper.plan(old, new))

    def test_rejects_non_video_device_major(self):
        with self.assertRaises(ValueError):
            helper.plan({}, {'devices': {'video0': {'major': 8, 'minor': 0, 'gid': 44}}, 'links': {}})

    def test_alias_must_point_to_a_discovered_capture_node(self):
        with self.assertRaises(ValueError):
            helper.plan({}, {'devices': {}, 'links': {'usb-camera': 'video2'}})


if __name__ == '__main__':
    unittest.main()
