import createHardwareEncoder from './hardware';

const service = createHardwareEncoder({
	coder: 'hevc_qsv',
	name: 'HEVC (Intel Quick Sync)',
	codec: 'hevc',
	defaultDevice: '/dev/dri/renderD128',
	defaultPreset: 'veryfast',
	presets: ['veryfast', 'faster', 'fast', 'medium', 'slow', 'slower', 'veryslow'],
	globalOptions: (settings) => [
		['-init_hw_device', `vaapi=restreamer_vaapi:${settings.device}`],
		['-init_hw_device', 'qsv=restreamer_qsv@restreamer_vaapi'],
		['-filter_hw_device', 'restreamer_qsv'],
	],
	filters: ['format=nv12'],
	localOptions: ['-async_depth', '1', '-forced_idr', '1'],
});

const { coder, name, codec, type, hwaccel, summarize, defaults, component } = service;
export { coder, name, codec, type, hwaccel, summarize, defaults, component };
