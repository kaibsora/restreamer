import { createChannelBundle, prepareChannelImport, validateBundle } from './channel-bundle';

const oldChannel = '11111111-1111-4111-8111-111111111111';
const newChannel = '22222222-2222-4222-8222-222222222222';
const newEgress = '33333333-3333-4333-8333-333333333333';
const ingestId = `restreamer-ui:ingest:${oldChannel}`;
const egressId = 'restreamer-ui:egress:mediamtx:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

const process = (id, extra = {}) => ({
	id,
	config: {
		id,
		reference: oldChannel,
		type: 'ffmpeg',
		input: [{ address: `{memfs}/${oldChannel}.m3u8` }],
		output: [],
		autostart: true,
		...extra,
	},
	metadata: {},
});

describe('channel bundles', () => {
	it('exports a versioned bundle containing only portable process data', () => {
		const bundle = createChannelBundle(
			{ channelid: oldChannel, name: 'Printer One' },
			[process(ingestId), process(egressId)],
			[],
			'2026-11-09T12:00:00.000Z',
		);

		expect(bundle).toMatchObject({
			type: 'restreamer-channel-bundle',
			version: 2,
			exported_at: '2026-11-09T12:00:00.000Z',
			channel: { id: oldChannel, name: 'Printer One' },
		});
		expect(bundle.processes[0]).not.toHaveProperty('state');
	});

	it('remaps binary-safe channel assets and accepts legacy version 1 bundles', () => {
		const path = `/channels/${oldChannel}/logo.png`;
		const bundle = createChannelBundle(
			{ channelid: oldChannel, name: 'Printer One' },
			[process(ingestId)],
			[{ path, content_type: 'image/png', encoding: 'base64', data: 'AAEC' }],
		);
		const imported = prepareChannelImport(bundle, () => newChannel);

		expect(imported.assets).toEqual([{ path: `/channels/${newChannel}/logo.png`, content_type: 'image/png', encoding: 'base64', data: 'AAEC' }]);

		const legacy = { ...bundle, version: 1 };
		delete legacy.assets;
		expect(prepareChannelImport(legacy, () => newChannel).assets).toEqual([]);
	});

	it('rejects assets outside the channel directory', () => {
		const bundle = createChannelBundle({ channelid: oldChannel, name: 'Printer One' }, [process(ingestId)]);
		bundle.assets.push({ path: '/channels/another/logo.png', encoding: 'base64', data: 'AAEC' });

		expect(() => validateBundle(bundle)).toThrow('invalid channel asset path');
	});

	it('remaps channel and process IDs everywhere on import', () => {
		const bundle = createChannelBundle({ channelid: oldChannel, name: 'Printer One' }, [
			process(ingestId, { options: [`https://example.test/${oldChannel}/oembed.json`] }),
			process(`${ingestId}_snapshot`),
			process(egressId, { output: [{ address: `rtsp://camera/${oldChannel}` }] }),
		]);
		const ids = [newChannel, newEgress];
		const imported = prepareChannelImport(bundle, () => ids.shift());

		expect(imported.channel).toEqual({ id: newChannel, name: 'Printer One' });
		expect(imported.processes.map((item) => item.id)).toEqual([
			`restreamer-ui:ingest:${newChannel}`,
			`restreamer-ui:ingest:${newChannel}_snapshot`,
			`restreamer-ui:egress:mediamtx:${newEgress}`,
		]);
		for (const item of imported.processes) {
			expect(item.config.reference).toBe(newChannel);
			expect(JSON.stringify(item)).not.toContain(oldChannel);
		}
	});

	it('rejects unrelated or malformed processes', () => {
		const bundle = createChannelBundle({ channelid: oldChannel, name: 'Printer One' }, [process(ingestId)]);
		bundle.processes.push(process('someone-elses-process'));

		expect(() => validateBundle(bundle)).toThrow('does not belong to this channel');
	});
});
