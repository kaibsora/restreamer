import { preserveChannelOnProgressMiss } from './index';

const missingProgress = {
	valid: false,
	state: 'disconnected',
	error: '',
};

describe('main channel progress polling', () => {
	it('preserves a mounted player across a transient state-poll failure', () => {
		const previous = {
			ready: true,
			valid: true,
			state: 'connected',
			progress: { valid: true, state: 'connected', frames: 120 },
		};

		const next = preserveChannelOnProgressMiss(
			{ available: true },
			previous,
			missingProgress,
		);

		expect(next).toBe(previous);
	});

	it('shows an in-place error when the first poll misses for a saved channel', () => {
		const previous = {
			ready: false,
			valid: false,
			state: 'disconnected',
			progress: {},
		};

		const next = preserveChannelOnProgressMiss(
			{ available: true },
			previous,
			missingProgress,
		);

		expect(next).toMatchObject({
			ready: true,
			valid: true,
			state: 'error',
			progress: {
				valid: true,
				state: 'error',
				error: 'Temporarily unable to retrieve stream state.',
			},
		});
	});

	it('allows the setup screen when the channel has no saved ingest', () => {
		const previous = {
			ready: true,
			valid: false,
			state: 'disconnected',
			progress: {},
		};

		expect(
			preserveChannelOnProgressMiss(
				{ available: false },
				previous,
				missingProgress,
			),
		).toBeNull();
	});
});
