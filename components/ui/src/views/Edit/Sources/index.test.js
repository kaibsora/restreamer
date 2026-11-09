import SemverSatisfies from 'semver/functions/satisfies';

import Sources from '.';

describe('source FFmpeg compatibility', () => {
	test.each(['7.1.1', '8.0.1', '9.0.0'])('keeps every source available on FFmpeg %s', (version) => {
		const incompatible = Sources.List()
			.filter((source) => !SemverSatisfies(version, source.ffversion))
			.map((source) => source.id);

		expect(incompatible).toEqual([]);
	});

	test('retains the real minimum supported FFmpeg version', () => {
		for (const source of Sources.List()) {
			expect(SemverSatisfies('4.0.2', source.ffversion)).toBe(false);
			expect(SemverSatisfies('4.1.0', source.ffversion)).toBe(true);
		}
	});
});
