import React from 'react';
import { act, render } from '../../../utils/testing';

import * as MediaMTX from './MediaMTX';
import Services from './index';

test('registers the MediaMTX preset with browser-compatible H.264 output', () => {
	const service = Services.Get('mediamtx');

	expect(service).not.toBe(null);
	expect(service.name).toBe('MediaMTX LAN relay');
	expect(service.requires.codecs.video).toEqual(['h264']);
});

test('creates a low-latency MediaMTX RTSP publication', () => {
	expect(
		MediaMTX.createOutput({
			server: 'mediamtx:8554/',
			path: '/printer-one/',
			transport: 'tcp',
		}),
	).toEqual({
		address: 'rtsp://mediamtx:8554/printer-one',
		options: [
			'-f',
			'rtsp',
			'-rtsp_transport',
			'tcp',
			'-muxdelay',
			'0',
			'-pkt_size',
			'1200',
		],
	});
});

test('accepts UDP without allowing arbitrary transport options', () => {
	expect(
		MediaMTX.createOutput({
			server: 'rtsp://relay.lan:8554',
			path: 'camera',
			transport: 'udp',
		}).options,
	).toContain('udp');
	expect(
		MediaMTX.createOutput({
			server: 'rtsp://relay.lan:8554',
			path: 'camera',
			transport: 'nonsense',
		}).options,
	).toContain('tcp');
});

test('does not invent a destination with an empty server or path', () => {
	expect(MediaMTX.createOutput({ server: '', path: 'camera' }).address).toBe(
		'',
	);
	expect(
		MediaMTX.createOutput({ server: 'mediamtx:8554', path: '' }).address,
	).toBe('');
});

test('derives a safe default path from channel metadata', () => {
	expect(MediaMTX.init({}, { name: 'Printer One / Toolhead' }).path).toBe(
		'printer-one-toolhead',
	);
	expect(MediaMTX.slugifyPath('***')).toBe('camera');
});

test('creates usable LAN client URLs without leaking UI ports or paths', () => {
	expect(
		MediaMTX.createClientUrls({
			client_host: 'https://restreamer.lan:8080/ui/',
			path: '/printer-one/',
		}),
	).toEqual({
		rtsp: 'rtsp://restreamer.lan:8554/printer-one',
		webrtc: 'http://restreamer.lan:8889/printer-one',
	});

	expect(MediaMTX.normalizeClientHost('[fd00::20]:8080')).toBe('[fd00::20]');
	expect(
		MediaMTX.createClientUrls({ client_host: '', path: 'printer-one' }),
	).toEqual({ rtsp: '', webrtc: '' });
});

test('initializes the publication output when the form opens', async () => {
	const changes = [];

	await act(async () => {
		render(
			<MediaMTX.component
				metadata={{ name: 'Printer One' }}
				onChange={(outputs, settings) =>
					changes.push({ outputs, settings })
				}
			/>,
		);
	});

	expect(changes).toHaveLength(1);
	expect(changes[0].outputs[0].address).toBe(
		'rtsp://mediamtx:8554/printer-one',
	);
	expect(changes[0].settings.transport).toBe('tcp');
});
