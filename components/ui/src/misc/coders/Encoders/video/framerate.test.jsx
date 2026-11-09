import * as AV1Rav1e from './av1_librav1e';
import * as AV1VAAPI from './av1_vaapi';
import * as H264Libx264 from './h264_libx264';
import * as H264QSV from './h264_qsv';
import * as H264V4L2M2M from './h264_v4l2m2m';
import * as H264Vulkan from './h264_vulkan';
import * as HEVCLibx265 from './hevc_libx265';
import * as VP9Libvpx from './vp9_libvpx';

const modernSkills = { ffmpeg: { version_major: 9 } };

const encoders = [
	['libx264', H264Libx264],
	['libx265', HEVCLibx265],
	['libvpx-vp9', VP9Libvpx],
	['librav1e', AV1Rav1e],
	['av1_vaapi', AV1VAAPI],
	['h264_v4l2m2m', H264V4L2M2M],
	['h264_qsv', H264QSV],
	['h264_vulkan', H264Vulkan],
];

function optionValue(options, name) {
	const index = options.indexOf(name);
	return index === -1 ? undefined : options[index + 1];
}

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
