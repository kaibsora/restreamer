import * as Youtube from './Services/Youtube';
import * as Helper from './helper';

const skills = {
	ffmpeg: {},
	protocols: { output: ['rtmps', 'https'] },
	formats: { muxers: ['flv', 'hls'] },
	sinks: {},
	codecs: {
		audio: { aac: ['aac'] },
		video: { h264: ['libx264'] },
	},
	encoders: {
		audio: ['aac'],
		video: ['libx264'],
	},
};

test('allows a service to forbid audio copy without disabling video copy', () => {
	const serviceSkills = Helper.conflateServiceSkills(
		Youtube.requires,
		skills,
	);

	expect(serviceSkills.codecs.audio).toEqual(['aac']);
	expect(serviceSkills.codecs.video).toEqual(['copy', 'h264']);
});

test('replaces copied YouTube AAC with a 128 kbit/s AAC encoder', () => {
	const profile = {
		source: 0,
		stream: 0,
		encoder: {
			coder: 'copy',
			settings: {},
			mapping: { global: [], local: [], filter: [] },
		},
	};
	const serviceSkills = Helper.conflateServiceSkills(
		Youtube.requires,
		skills,
	);
	const selected = Helper.preselectProfile(
		profile,
		'audio',
		[{ type: 'audio', codec: 'aac' }],
		serviceSkills.codecs.audio,
		skills,
	);

	expect(selected.encoder.coder).toBe('aac');
	expect(selected.encoder.settings.bitrate).toBe('128');
	expect(selected.encoder.mapping.local).toContain('128k');
});
