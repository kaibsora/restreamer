import { createGraph, defaults, init, summarize } from './Resample';

describe('audio resample filter', () => {
	it('corrects live capture-clock drift by default', () => {
		expect(defaults()).toEqual({
			settings: init({}),
			graph: 'aresample=osr=44100:ochl=stereo:async=1000:first_pts=0',
		});
	});

	it('upgrades existing settings without silently preserving zero compensation', () => {
		expect(createGraph({ sampling: '48000', layout: 'mono' })).toBe(
			'aresample=osr=48000:ochl=mono:async=1000:first_pts=0',
		);
	});

	it('allows compensation to be disabled for sources with unsuitable timestamps', () => {
		expect(
			createGraph({
				sampling: 'inherit',
				layout: 'inherit',
				compensate: false,
			}),
		).toBe('');
	});

	it('reports whether clock synchronization is active', () => {
		expect(summarize({ sampling: '48000', layout: 'stereo' })).toBe(
			'Resample (stereo, 48000Hz, clock sync)',
		);
		expect(
			summarize({
				sampling: '48000',
				layout: 'stereo',
				compensate: false,
			}),
		).toBe('Resample (stereo, 48000Hz)');
	});
});
