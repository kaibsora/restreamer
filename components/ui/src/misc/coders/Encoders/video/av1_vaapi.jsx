import createHardwareEncoder from './hardware';

const service = createHardwareEncoder({
	coder: 'av1_vaapi',
	name: 'AV1 (VA-API: Intel/AMD)',
	codec: 'av1',
	defaultDevice: '/dev/dri/renderD128',
	presets: null,
	globalOptions: (settings) => [['-vaapi_device', settings.device]],
	filters: ['format=nv12', 'hwupload'],
	localOptions: ['-profile:v', 'main'],
});

const { coder, name, codec, type, hwaccel, summarize, defaults, component } = service;
export { coder, name, codec, type, hwaccel, summarize, defaults, component };
