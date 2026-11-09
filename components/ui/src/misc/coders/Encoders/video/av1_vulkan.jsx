import createHardwareEncoder from './hardware';

const service = createHardwareEncoder({
	coder: 'av1_vulkan',
	name: 'AV1 (Vulkan Video)',
	codec: 'av1',
	defaultDevice: '0',
	presets: null,
	globalOptions: (settings) => [
		['-init_hw_device', `vulkan=restreamer_vk:${settings.device}`],
		['-filter_hw_device', 'restreamer_vk'],
	],
	filters: ['format=nv12', 'hwupload=extra_hw_frames=16'],
	localOptions: ['-tune', 'ull', '-usage', 'stream', '-content', 'camera', '-profile:v', 'main'],
});

const { coder, name, codec, type, hwaccel, summarize, defaults, component } = service;
export { coder, name, codec, type, hwaccel, summarize, defaults, component };
