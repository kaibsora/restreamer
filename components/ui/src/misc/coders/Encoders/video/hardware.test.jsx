import * as AV1NVENC from './av1_nvenc';
import * as AV1QSV from './av1_qsv';
import * as AV1VAAPI from './av1_vaapi';
import * as AV1Vulkan from './av1_vulkan';
import * as H264QSV from './h264_qsv';
import * as H264VAAPI from './h264_vaapi';
import * as HEVCNVENC from './hevc_nvenc';
import * as HEVCQSV from './hevc_qsv';
import * as HEVCVAAPI from './hevc_vaapi';
import * as H264Vulkan from './h264_vulkan';
import * as HEVCVulkan from './hevc_vulkan';
import * as VP9QSV from './vp9_qsv';
import * as VP9VAAPI from './vp9_vaapi';
import { Video } from '../index';

const skills = { ffmpeg: { version_major: 8 } };

test.each([
	['av1_nvenc', AV1NVENC],
	['av1_qsv', AV1QSV],
	['av1_vaapi', AV1VAAPI],
	['av1_vulkan', AV1Vulkan],
	['h264_vaapi', H264VAAPI],
	['hevc_nvenc', HEVCNVENC],
	['hevc_vaapi', HEVCVAAPI],
	['vp9_qsv', VP9QSV],
	['vp9_vaapi', VP9VAAPI],
])('%s is available through the video encoder registry', (coder, service) => {
	expect(Video.Get(coder)).toBe(service);
});

test.each([
	[H264QSV, 'h264_qsv', ['format=nv12']],
	[HEVCQSV, 'hevc_qsv', ['format=nv12']],
	[H264Vulkan, 'h264_vulkan', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[HEVCVulkan, 'hevc_vulkan', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[AV1VAAPI, 'av1_vaapi', ['format=nv12', 'hwupload']],
	[AV1NVENC, 'av1_nvenc', []],
	[HEVCNVENC, 'hevc_nvenc', []],
	[AV1QSV, 'av1_qsv', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[VP9QSV, 'vp9_qsv', ['format=nv12', 'hwupload=extra_hw_frames=16']],
	[AV1Vulkan, 'av1_vulkan', ['format=nv12', 'hwupload=extra_hw_frames=16']],
])('$coder creates a low-latency hardware mapping', (service, expectedCoder, expectedFilters) => {
	const { settings, mapping } = service.defaults({}, skills);

	expect(mapping.local).toEqual(expect.arrayContaining(['-codec:v', expectedCoder, '-bf', '0', '-fps_mode', 'cfr']));
	expect(settings.gop).toBe('1');
	expect(mapping.filter).toEqual(expectedFilters);
});

test('QSV binds to the selected DRM render node', () => {
	const { mapping } = H264QSV.defaults({}, skills);

	expect(mapping.global).toContainEqual(['-init_hw_device', 'vaapi=restreamer_vaapi:/dev/dri/renderD128']);
	expect(mapping.global).toContainEqual(['-init_hw_device', 'qsv=restreamer_qsv@restreamer_vaapi']);
	expect(mapping.local).toEqual(expect.arrayContaining(['-async_depth', '1']));
	expect(mapping.local).toEqual(expect.arrayContaining(['-low_power', '1']));
});

test('QSV preserves an explicit full-power encoder selection', () => {
	const { mapping } = H264QSV.defaults({}, skills, { low_power: '0' });
	expect(mapping.local).toEqual(expect.arrayContaining(['-low_power', '0']));
	expect(mapping.filter).toEqual(['format=nv12']);
});

test('HEVC QSV derives the selected render device and uses system-memory NV12', () => {
	const { mapping } = HEVCQSV.defaults({}, skills, { device: '/dev/dri/renderD129' });
	expect(mapping.global).toContainEqual(['-init_hw_device', 'vaapi=restreamer_vaapi:/dev/dri/renderD129']);
	expect(mapping.global).toContainEqual(['-init_hw_device', 'qsv=restreamer_qsv@restreamer_vaapi']);
	expect(mapping.filter).toEqual(['format=nv12']);
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

test.each([
	[H264VAAPI, 'h264_vaapi'],
	[HEVCVAAPI, 'hevc_vaapi'],
	[VP9VAAPI, 'vp9_vaapi'],
])('$coder binds to the selected VA-API render node with low-latency defaults', (service, coder) => {
	const { settings, mapping } = service.defaults({}, skills, { device: '/dev/dri/renderD129' });

	expect(settings.gop).toBe('1');
	expect(mapping.global).toContainEqual(['-vaapi_device', '/dev/dri/renderD129']);
	expect(mapping.local).toEqual(expect.arrayContaining(['-codec:v', coder, '-bf', '0', '-fps_mode', 'cfr']));
});

test.each([
	[AV1QSV, 'av1_qsv'],
	[VP9QSV, 'vp9_qsv'],
])('$coder binds to the selected QSV render node', (service, coder) => {
	const { mapping } = service.defaults({}, skills, { device: '/dev/dri/renderD129' });

	expect(mapping.global).toContainEqual(['-init_hw_device', 'qsv=restreamer_qsv:hw,child_device=/dev/dri/renderD129']);
	expect(mapping.local).toEqual(expect.arrayContaining(['-codec:v', coder, '-async_depth', '1']));
});

test.each([
	[AV1NVENC, 'av1_nvenc'],
	[HEVCNVENC, 'hevc_nvenc'],
])('$coder selects the requested NVIDIA GPU with zero-latency options', (service, coder) => {
	const { mapping } = service.defaults({}, skills, { device: '2' });

	expect(mapping.global).toEqual([]);
	expect(mapping.local).toEqual(
		expect.arrayContaining(['-codec:v', coder, '-gpu', '2', '-tune', 'ull', '-zerolatency', '1', '-forced-idr', '1']),
	);
});

test('AV1 Vulkan uses streaming and camera tuning on the selected device', () => {
	const { mapping } = AV1Vulkan.defaults({}, skills, { device: '1' });

	expect(mapping.global).toContainEqual(['-init_hw_device', 'vulkan=restreamer_vk:1']);
	expect(mapping.local).toEqual(expect.arrayContaining(['-codec:v', 'av1_vulkan', '-tune', 'ull', '-usage', 'stream', '-content', 'camera']));
});
