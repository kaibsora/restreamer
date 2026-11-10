import { probeSource } from './probeSource';
import { func as camera } from '../Sources/V4L';

const automatic = () => {
	const settings = camera.initSettings({ device: '/dev/video0' });
	return { type: 'video4linux2', settings, inputs: camera.createInputs(settings) };
};

test('automatic USB setup saves the same MJPEG mode that verified successfully', async () => {
	const source = automatic();
	const res = { streams: [{ type: 'video', codec: 'mjpeg' }] };
	const probe = vi.fn().mockResolvedValue([res, null]);
	const result = await probeSource(probe, source);
	expect(result.source.settings.format).toBe('mjpeg');
	expect(result.source.inputs).toEqual(probe.mock.lastCall[0]);
	expect(result.source.inputs[0].options).toEqual(['-f', 'video4linux2', '-input_format', 'mjpeg']);
	expect(source.settings.format).toBe('auto');
});

test('a camera without MJPEG falls back to automatic capture without saving an unsupported mode', async () => {
	const source = automatic();
	const raw = { streams: [{ type: 'video', codec: 'rawvideo' }] };
	const probe = vi
		.fn()
		.mockResolvedValueOnce([{ streams: [] }, null])
		.mockResolvedValueOnce([raw, null]);
	const result = await probeSource(probe, source);
	expect(probe).toHaveBeenCalledTimes(2);
	expect(result.source).toBe(source);
	expect(probe.mock.lastCall[0][0].options).toEqual(['-f', 'video4linux2']);
});

test('an explicit capture format is probed once and preserved', async () => {
	const source = automatic();
	source.settings.format = 'yuyv422';
	source.inputs = camera.createInputs(source.settings);
	const probe = vi.fn().mockResolvedValue([{ streams: [{ type: 'video', codec: 'rawvideo' }] }, null]);
	const result = await probeSource(probe, source);
	expect(probe).toHaveBeenCalledTimes(1);
	expect(result.source).toBe(source);
});
