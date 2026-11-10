import { installNetworkRecovery } from './network-recovery';

function fixture() {
	const handlers = new Map();
	let error = { code: 2 };
	const player = {
		on: vi.fn((name, handler) => handlers.set(name, handler)),
		one: vi.fn((name, handler) => handlers.set(name, handler)),
		off: vi.fn((name) => handlers.delete(name)),
		isDisposed: () => false,
		error: vi.fn((...values) => (values.length ? (error = values[0]) : error)),
		paused: () => false,
		autoplay: () => true,
		currentSource: () => ({ src: 'http://camera/live.m3u8', type: 'application/x-mpegURL' }),
		src: vi.fn(),
		play: vi.fn(() => Promise.resolve()),
	};
	return { player, fire: (name) => handlers.get(name)?.() };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
	vi.clearAllTimers();
	vi.useRealTimers();
});

test('retries repeated startup 404s until the camera playlist becomes available', () => {
	const { player, fire } = fixture();
	installNetworkRecovery(player);
	for (let attempt = 0; attempt < 3; attempt++) {
		player.error({ code: 2 });
		fire('error');
		vi.advanceTimersByTime(5000);
	}
	expect(player.src).toHaveBeenCalledTimes(3);
	expect(player.play).toHaveBeenCalledTimes(3);
});

test('deduplicates repeated errors and cancels a pending retry on successful metadata', () => {
	const { player, fire } = fixture();
	installNetworkRecovery(player);
	fire('error');
	fire('error');
	fire('loadedmetadata');
	vi.advanceTimersByTime(10000);
	expect(player.src).not.toHaveBeenCalled();
});

test('disposal stops retries instead of leaving a background player running', () => {
	const { player, fire } = fixture();
	installNetworkRecovery(player);
	fire('error');
	fire('dispose');
	vi.advanceTimersByTime(10000);
	expect(player.src).not.toHaveBeenCalled();
});

test('does not reset a source for decode failures or force playback on a paused manual player', () => {
	const { player, fire } = fixture();
	player.paused = () => true;
	player.autoplay = () => false;
	installNetworkRecovery(player);
	player.error({ code: 3 });
	fire('error');
	vi.advanceTimersByTime(5000);
	expect(player.src).not.toHaveBeenCalled();
	player.error({ code: 2 });
	fire('error');
	vi.advanceTimersByTime(5000);
	expect(player.src).toHaveBeenCalledTimes(1);
	expect(player.play).not.toHaveBeenCalled();
});
