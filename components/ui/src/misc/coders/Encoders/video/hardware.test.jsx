import * as AV1VAAPI from './av1_vaapi';
import * as H264QSV from './h264_qsv';
import * as HEVCQSV from './hevc_qsv';
import * as H264Vulkan from './h264_vulkan';
import * as HEVCVulkan from './hevc_vulkan';
import { Video } from '../index';

const skills = { ffmpeg: { version_major: 8 } };

test('AV1 VA-API is available through the video encoder registry', () => {
	expect(Video.Get('av1_vaapi')).toBe(AV1VAAPI);
});

test.each([
	[H264QSV, 'h264_qsv', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[HEVCQSV, 'hevc_qsv', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[H264Vulkan, 'h264_vulkan', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[HEVCVulkan, 'hevc_vulkan', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[AV1VAAPI, 'av1_vaapi', ['format=nv12', 'hwupload']],
])('$coder creates a low-latency hardware mapping', (service, expectedCoder, expectedFilters) => {
	const { settings, mapping } = service.defaults({}, skills);

	expect(mapping.local).toEqual(expect.arrayContaining(['-codec:v', expectedCoder, '-bf', '0', '-fps_mode', 'cfr']));
	expect(settings.gop).toBe('1');
	expect(mapping.filter).toEqual(expectedFilters);
});

test('QSV binds to the selected DRM render node', () => {
	const { mapping } = H264QSV.defaults({}, skills);

	expect(mapping.global).toContainEqual(['-init_hw_device', 'qsv=restreamer_qsv:hw,child_device=/dev/dri/renderD128']);
	expect(mapping.local).toEqual(expect.arrayContaining(['-async_depth', '1']));
});

test('Vulkan binds to the selected Vulkan device', () => {
	const { mapping } = H264Vulkan.defaults({}, skills);

	expect(mapping.global).toContainEqual(['-init_hw_device', 'vulkan=restreamer_vk:0']);
});

test('AV1 VA-API binds to the selected DRM render node and main profile', () => {
	const { mapping } = AV1VAAPI.defaults({}, skills, { device: '/dev/dri/renderD129' });

	expect(mapping.global).toContainEqual(['-vaapi_device', '/dev/dri/renderD129']);
	expect(mapping.local).toEqual(expect.arrayContaining(['-codec:v', 'av1_vaapi', '-profile:v', 'main']));
});
