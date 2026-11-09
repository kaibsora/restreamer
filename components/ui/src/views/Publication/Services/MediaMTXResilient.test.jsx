import React from 'react';
import { act, render } from '../../../utils/testing';

import * as MediaMTXResilient from './MediaMTXResilient';
import Services from './index';
import * as Helper from '../helper';

test('registers a video-only resilient MediaMTX preset', () => {
	const service = Services.Get('mediamtxresilient');

	expect(service).not.toBe(null);
	expect(service.name).toBe('MediaMTX resilient LAN relay');
	expect(service.requires.codecs.audio).toEqual(['none']);
	expect(service.requires.codecs.video).toEqual(['h264']);
	expect(service.requires.copy.audio).toBe(false);
	expect(service.requires.copy.video).toBe(true);
});

test('forces audio off while retaining H.264 passthrough', () => {
	const skills = {
		ffmpeg: {},
		protocols: { output: ['rtp'] },
		formats: { muxers: ['rtsp'] },
		sinks: {},
		codecs: {
			audio: { none: ['none'], aac: ['aac'] },
			video: { h264: ['libx264'] },
		},
		encoders: {
			audio: ['copy', 'none', 'aac'],
			video: ['copy', 'libx264'],
		},
	};
	const serviceSkills = Helper.conflateServiceSkills(
		MediaMTXResilient.requires,
		skills,
	);

	expect(serviceSkills.codecs.audio).toEqual(['none']);
	expect(serviceSkills.codecs.video).toEqual(['copy', 'h264']);

	const selected = Helper.preselectProfile(
		{
			source: 0,
			stream: 0,
			encoder: {
				coder: 'copy',
				settings: {},
				mapping: { global: [], local: [], filter: [] },
			},
		},
		'audio',
		[{ type: 'audio', codec: 'aac' }],
		serviceSkills.codecs.audio,
		skills,
	);

	expect(selected.encoder.coder).toBe('none');
	expect(selected.encoder.mapping.local).toContain('-an');
});

test('selects from the configured pool of resilient MediaMTX paths', () => {
	expect(MediaMTXResilient.pathOptions).toHaveLength(16);
	expect(MediaMTXResilient.pathOptions[0]).toBe('resilient/01');
	expect(MediaMTXResilient.pathOptions[15]).toBe('resilient/16');
	expect(MediaMTXResilient.init({}, { name: 'Printer One' }).path).toBe(
		'resilient/01',
	);
	expect(
		MediaMTXResilient.init(
			{ path: 'resilient/09' },
			{ name: 'Ignored default' },
		).path,
	).toBe('resilient/09');
});

test('initializes a resilient video-only publication when the form opens', async () => {
	const changes = [];

	await act(async () => {
		render(
			<MediaMTXResilient.component
				metadata={{ name: 'Printer One' }}
				onChange={(outputs, settings) =>
					changes.push({ outputs, settings })
				}
			/>,
		);
	});

	expect(changes).toHaveLength(1);
	expect(changes[0].outputs[0].address).toBe(
		'rtsp://mediamtx:8554/resilient/01',
	);
	expect(changes[0].settings.path).toBe('resilient/01');
});
