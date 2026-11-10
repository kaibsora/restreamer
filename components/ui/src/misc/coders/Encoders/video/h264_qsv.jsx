import createHardwareEncoder from './hardware';

const service = createHardwareEncoder({
	coder: 'h264_qsv',
	name: 'H.264 (Intel Quick Sync)',
	codec: 'h264',
	defaultDevice: '/dev/dri/renderD128',
	defaultPreset: 'veryfast',
	lowPower: true,
	presets: ['veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'],
	globalOptions: (settings) => [
		['-init_hw_device', `vaapi=restreamer_vaapi:${settings.device}`],
		['-init_hw_device', 'qsv=restreamer_qsv@restreamer_vaapi'],
		['-filter_hw_device', 'restreamer_qsv'],
	],
	// System-memory input also works with the legacy Media SDK runtime, whose
	// hardware-upload API is unavailable on older Intel GPUs.
	filters: ['format=nv12'],
	localOptions: (settings) => ['-async_depth', '1', '-forced_idr', '1', '-low_power', settings.low_power],
});

const { coder, name, codec, type, hwaccel, summarize, defaults, component } = service;
export { coder, name, codec, type, hwaccel, summarize, defaults, component };
