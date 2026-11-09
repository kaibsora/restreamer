import Restreamer from './restreamer';

const createRestreamer = () => {
	const restreamer = Object.create(Restreamer.prototype);
	restreamer.channels = new Map();
	return restreamer;
};

describe('Restreamer public landing page', () => {
	it('is disabled by default and preserves an explicit setting', () => {
		const restreamer = createRestreamer();

		expect(restreamer.InitPlayersiteSettings().playersite).toBe(false);
		expect(restreamer.InitPlayersiteSettings({ playersite: true }).playersite).toBe(true);
	});

	it('removes all generated landing pages when publication is disabled', async () => {
		const restreamer = createRestreamer();
		restreamer._listAssets = vi.fn(async () => [
			'/playersite_11111111-1111-4111-8111-111111111111.html',
			'/playersite_22222222-2222-4222-8222-222222222222.html',
			'/playersite_templates_should-not-be-deleted.html/escape',
		]);
		restreamer._deleteAsset = vi.fn(async () => true);

		await restreamer._removePlayersiteEssentials();

		expect(restreamer._listAssets).toHaveBeenCalledWith('/playersite_*.html');
		expect(restreamer._deleteAsset.mock.calls.map(([path]) => path)).toEqual([
			'/index.html',
			'/playersite_11111111-1111-4111-8111-111111111111.html',
			'/playersite_22222222-2222-4222-8222-222222222222.html',
			'/playersite/player.js',
			'/playersite/default_bg.jpg',
			'/playersite/bg.jpg',
			'/playersite/bg.png',
		]);
	});

	it('does not rebuild public assets while the landing page is disabled', async () => {
		const restreamer = createRestreamer();
		restreamer.GetMetadata = vi.fn(async () => ({ playersite: { playersite: false } }));
		restreamer._removePlayersiteEssentials = vi.fn(async () => true);
		restreamer._updatePlayerEssentials = vi.fn(async () => true);
		restreamer._updatePlayersiteEssentials = vi.fn(async () => true);

		await expect(restreamer.UpdatePlayersite()).resolves.toBe(true);
		expect(restreamer._removePlayersiteEssentials).toHaveBeenCalledOnce();
		expect(restreamer._updatePlayerEssentials).not.toHaveBeenCalled();
		expect(restreamer._updatePlayersiteEssentials).not.toHaveBeenCalled();
	});
});
