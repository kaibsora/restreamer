import Restreamer from './restreamer';
import { createChannelBundle } from './channel-bundle';

const channelId = '11111111-1111-4111-8111-111111111111';
const ingestId = `restreamer-ui:ingest:${channelId}`;

const savedProcess = {
	id: ingestId,
	config: {
		id: ingestId,
		reference: channelId,
		type: 'ffmpeg',
		input: [{ id: 'input_0', address: 'rtsp://camera.local/stream', options: [] }],
		output: [],
		options: [],
		autostart: true,
	},
	metadata: { meta: { name: 'Printer One' } },
};

const bundle = () => createChannelBundle({ channelid: channelId, name: 'Printer One' }, [savedProcess]);

describe('Restreamer channel migration', () => {
	it('exports the selected channel process and metadata', async () => {
		const restreamer = Object.create(Restreamer.prototype);
		restreamer.GetChannel = () => ({
			id: ingestId,
			channelid: channelId,
			name: 'Printer One',
			available: true,
			egresses: [],
		});
		restreamer._getProcess = async (id) => (id === ingestId ? savedProcess : null);
		restreamer._exportChannelAssets = vi.fn(async () => []);

		const [exported, err] = await restreamer.ExportChannel(channelId);

		expect(err).toBeNull();
		expect(exported.channel.name).toBe('Printer One');
		expect(exported.processes).toEqual([savedProcess]);
		expect(restreamer._exportChannelAssets).toHaveBeenCalledWith(channelId, [savedProcess]);
	});

	it('exports and restores referenced logo bytes under the remapped channel ID', async () => {
		const restreamer = Object.create(Restreamer.prototype);
		const logoPath = `/channels/${channelId}/logo.png`;
		const processWithLogo = { ...savedProcess, metadata: { player: { logo: { image: logoPath } } } };
		restreamer._listAssets = async () => [logoPath, `/channels/${channelId}/stale-poster.png`];
		restreamer._getAsset = async () => new Blob([new Uint8Array([0, 1, 2])], { type: 'image/png' });

		const assets = await restreamer._exportChannelAssets(channelId, [processWithLogo]);

		expect(assets).toEqual([{ path: logoPath, content_type: 'image/png', encoding: 'base64', data: 'AAEC' }]);
	});

	it('creates processes stopped, restores autostart, and refreshes the UI', async () => {
		const restreamer = Object.create(Restreamer.prototype);
		const updates = [];
		restreamer._upsertProcess = async (id, config) => {
			updates.push({ id, config });
			return [null, null];
		};
		restreamer._setProcessMetadata = async () => true;
		restreamer._deleteAsset = vi.fn(async () => true);
		restreamer._discoverChannels = async () => {};
		restreamer.SelectChannel = vi.fn();
		restreamer.UpdatePlayer = vi.fn(async () => true);
		restreamer.UpdatePlayersite = vi.fn(async () => true);
		restreamer.api = { DataPutFile: vi.fn(async () => ({ val: null, err: null })) };

		const [importedId, err] = await restreamer.ImportChannel(bundle());

		expect(err).toBeNull();
		expect(importedId).not.toBe(channelId);
		expect(updates).toHaveLength(2);
		expect(updates[0].config.autostart).toBe(false);
		expect(updates[1].config.autostart).toBe(true);
		expect(restreamer.SelectChannel).toHaveBeenCalledWith(importedId);
		expect(restreamer.UpdatePlayer).toHaveBeenCalledWith(importedId);
	});

	it('uploads bundled assets before creating the imported process', async () => {
		const restreamer = Object.create(Restreamer.prototype);
		const calls = [];
		restreamer.api = {
			DataPutFile: vi.fn(async (path, data) => {
				calls.push({ type: 'asset', path, data });
				return { val: null, err: null };
			}),
		};
		restreamer._upsertProcess = async (id) => {
			calls.push({ type: 'process', id });
			return [null, null];
		};
		restreamer._setProcessMetadata = async () => true;
		restreamer._deleteAsset = vi.fn(async () => true);
		restreamer._discoverChannels = async () => {};
		restreamer.SelectChannel = vi.fn();
		restreamer.UpdatePlayer = vi.fn(async () => true);
		restreamer.UpdatePlayersite = vi.fn(async () => true);
		const withLogo = createChannelBundle(
			{ channelid: channelId, name: 'Printer One' },
			[savedProcess],
			[{ path: `/channels/${channelId}/logo.png`, content_type: 'image/png', encoding: 'base64', data: 'AAEC' }],
		);

		const [importedId, err] = await restreamer.ImportChannel(withLogo);

		expect(err).toBeNull();
		expect(calls[0]).toMatchObject({ type: 'asset', path: `/channels/${importedId}/logo.png` });
		expect(calls[0].data).toBeInstanceOf(Blob);
		expect(calls[1]).toMatchObject({ type: 'process' });
	});

	it('rolls back processes when metadata import fails', async () => {
		const restreamer = Object.create(Restreamer.prototype);
		const deleted = [];
		restreamer._upsertProcess = async () => [null, null];
		restreamer._setProcessMetadata = async () => false;
		restreamer._deleteProcess = async (id) => deleted.push(id);
		restreamer._deleteAsset = vi.fn(async () => true);
		restreamer.api = { DataPutFile: vi.fn(async () => ({ val: null, err: null })) };

		const [importedId, err] = await restreamer.ImportChannel(bundle());

		expect(importedId).toBe('');
		expect(err.message).toContain('Failed to import metadata');
		expect(deleted).toHaveLength(1);
	});
});
