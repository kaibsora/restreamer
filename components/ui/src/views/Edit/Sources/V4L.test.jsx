import * as V4L from './V4L';

test('automatic USB capture does not force unsupported formats or obsolete input options', () => {
	const settings = V4L.func.initSettings({ device: '/dev/video0' });
	expect(V4L.func.createInputs(settings)).toEqual([
		{ address: '/dev/video0', options: ['-f', 'video4linux2'] },
	]);
});

test('explicit camera modes are preserved without throttling a real-time device', () => {
	const settings = V4L.func.initSettings({
		device: '/dev/video2',
		format: 'mjpeg',
		size: '640x480',
		framerate: '15',
	});
	expect(V4L.func.createInputs(settings)[0].options).toEqual([
		'-f',
		'video4linux2',
		'-framerate',
		'15',
		'-video_size',
		'640x480',
		'-input_format',
		'mjpeg',
	]);
});
