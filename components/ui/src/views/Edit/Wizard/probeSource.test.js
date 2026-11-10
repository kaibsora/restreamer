import { probeSource } from './probeSource';
import '../../../I18n';
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

test('automatic capture prefers advertised camera H.264 and preserves the verified mode', async () => {
	const source = automatic();
	const probe = vi.fn().mockResolvedValue([{ streams: [{ type: 'video', codec: 'h264' }] }, null]);
	const getModes = vi.fn().mockResolvedValue([[{ input_format: 'h264' }, { input_format: 'mjpeg' }], null]);
	const result = await probeSource(probe, source, getModes);
	expect(result.source.settings.format).toBe('h264');
	expect(result.source.inputs[0].options).toContain('h264');
	expect(probe).toHaveBeenCalledTimes(1);
});

test('a failed camera H.264 probe falls back to advertised MJPEG', async () => {
	const probe = vi
		.fn()
		.mockResolvedValueOnce([{ streams: [] }, null])
		.mockResolvedValueOnce([{ streams: [{ type: 'video', codec: 'mjpeg' }] }, null]);
	const result = await probeSource(probe, automatic(), async () => [[{ input_format: 'h264' }, { input_format: 'mjpeg' }], null]);
	expect(result.source.settings.format).toBe('mjpeg');
});

test('rejects a driver silently substituting another format or resolution', async () => {
	const source = automatic();
	source.settings = { ...source.settings, format: 'h264', size: '1920x1080' };
	source.inputs = camera.createInputs(source.settings);
	const result = await probeSource(async () => [{ streams: [{ type: 'video', codec: 'mjpeg', width: 640, height: 480 }] }, null], source);
	expect(result.err.message).toContain('did not supply the requested');
});
