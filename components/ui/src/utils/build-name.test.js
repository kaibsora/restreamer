import { describe, expect, it } from 'vitest';
import { buildName } from './build-name';

describe('commit-seeded build names', () => {
	it('is stable across repeated calls, casing and whitespace', () => {
		const commit = '1055016ed537ebcc5a22deb68dbb2dacd20ae8e8';
		expect(buildName(commit)).toBe(buildName(` ${commit.toUpperCase()} `));
		expect(buildName(commit)).toMatch(/^[a-z]+-[a-z]+-\d{4}$/);
	});
	it('changes when the code revision changes', () => {
		expect(buildName('a'.repeat(40))).not.toBe(buildName('b'.repeat(40)));
	});
	it('has a deterministic local-development fallback', () => {
		expect(buildName()).toBe(buildName('local-development'));
	});
});
