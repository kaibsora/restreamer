import createHardwareEncoder from './hardware';

const service = createHardwareEncoder({
	coder: 'av1_nvenc',
	name: 'AV1 (NVIDIA NVENC)',
	codec: 'av1',
	defaultDevice: '0',
	defaultPreset: 'p4',
	presets: ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7'],
	globalOptions: () => [],
	filters: [],
	localOptions: (settings) => [
		'-gpu',
		settings.device,
		'-pix_fmt',
		'yuv420p',
		'-tune',
		'ull',
		'-zerolatency',
		'1',
		'-forced-idr',
		'1',
	],
});

const { coder, name, codec, type, hwaccel, summarize, defaults, component } = service;
export { coder, name, codec, type, hwaccel, summarize, defaults, component };
