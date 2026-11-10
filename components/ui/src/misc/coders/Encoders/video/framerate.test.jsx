import * as AV1Rav1e from './av1_librav1e';
import * as AV1NVENC from './av1_nvenc';
import * as AV1QSV from './av1_qsv';
import * as AV1VAAPI from './av1_vaapi';
import * as AV1Vulkan from './av1_vulkan';
import * as H264Libx264 from './h264_libx264';
import * as H264QSV from './h264_qsv';
import * as H264VAAPI from './h264_vaapi';
import * as H264V4L2M2M from './h264_v4l2m2m';
import * as H264Vulkan from './h264_vulkan';
import * as HEVCLibx265 from './hevc_libx265';
import * as HEVCNVENC from './hevc_nvenc';
import * as HEVCVAAPI from './hevc_vaapi';
import * as VP9Libvpx from './vp9_libvpx';
import * as VP9QSV from './vp9_qsv';
import * as VP9VAAPI from './vp9_vaapi';

const modernSkills = { ffmpeg: { version_major: 9 } };

const encoders = [
	['libx264', H264Libx264],
	['libx265', HEVCLibx265],
	['libvpx-vp9', VP9Libvpx],
	['librav1e', AV1Rav1e],
	['av1_nvenc', AV1NVENC],
	['av1_qsv', AV1QSV],
	['av1_vaapi', AV1VAAPI],
	['av1_vulkan', AV1Vulkan],
	['hevc_nvenc', HEVCNVENC],
	['h264_v4l2m2m', H264V4L2M2M],
	['h264_qsv', H264QSV],
	['h264_vaapi', H264VAAPI],
	['h264_vulkan', H264Vulkan],
	['vp9_qsv', VP9QSV],
	['hevc_vaapi', HEVCVAAPI],
	['vp9_vaapi', VP9VAAPI],
];

function optionValue(options, name) {
	const index = options.indexOf(name);
	return index === -1 ? undefined : options[index + 1];
}

test.each(encoders)('%s preserves fractional FPS and sub-second keyframe intervals', (_name, encoder) => {
	const halfSecond = encoder.defaults({}, modernSkills, { fps: '29.97', gop: '0.5' });
	expect(optionValue(halfSecond.mapping.local, '-g')).toBe('15');
	const quarterSecond = encoder.defaults({}, modernSkills, { fps: '15', gop: '0.25' });
	expect(optionValue(quarterSecond.mapping.local, '-g')).toBe('4');
	if (quarterSecond.mapping.local.includes('-keyint_min')) {
		expect(optionValue(quarterSecond.mapping.local, '-keyint_min')).toBe('4');
	}
	const lowFps = encoder.defaults({}, modernSkills, { fps: '0.5', gop: '0.25' });
	expect(optionValue(lowFps.mapping.local, '-g')).toBe('1');
});

test.each(encoders)(
	'%s omits output -r in passthrough mode',
	(_name, encoder) => {
		const { mapping } = encoder.defaults({}, modernSkills, {
			fps: '30',
			fps_mode: 'passthrough',
		});

		expect(optionValue(mapping.local, '-fps_mode')).toBe('passthrough');
		expect(optionValue(mapping.local, '-r')).toBeUndefined();
	},
);

test.each(encoders)(
	'%s omits output -r in variable-frame-rate mode',
	(_name, encoder) => {
		const { mapping } = encoder.defaults({}, modernSkills, {
			fps: '30',
			fps_mode: 'vfr',
		});

		expect(optionValue(mapping.local, '-fps_mode')).toBe('vfr');
		expect(optionValue(mapping.local, '-r')).toBeUndefined();
	},
);

test.each(encoders)(
	'%s retains output -r in constant-frame-rate mode',
	(_name, encoder) => {
		const { mapping } = encoder.defaults({}, modernSkills, {
			fps: '30',
			fps_mode: 'cfr',
		});

		expect(optionValue(mapping.local, '-fps_mode')).toBe('cfr');
		expect(optionValue(mapping.local, '-r')).toBe('30');
	},
);

test('FFmpeg 4 retains the legacy output frame-rate option', () => {
	const { mapping } = H264Libx264.defaults(
		{},
		{ ffmpeg: { version_major: 4 } },
		{
			fps: '30',
			fps_mode: 'passthrough',
		},
	);

	expect(optionValue(mapping.local, '-fps_mode')).toBeUndefined();
	expect(optionValue(mapping.local, '-r')).toBe('30');
});
