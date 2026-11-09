import { describe, expect, it } from 'vitest';

import * as Project from './project';

describe('maintained project links', () => {
	it('keeps operational links on the maintained fork', () => {
		for (const link of [Project.Repository, Project.Documentation, Project.Issues, Project.License, Project.Core, Project.Requirements]) {
			expect(link).toMatch(/^https:\/\/github\.com\/kaibsora\/restreamer(?:\/|$)/);
		}
	});

	it('keeps explicit upstream attribution links', () => {
		expect(Project.UpstreamRepository).toBe('https://github.com/datarhei/restreamer');
		expect(Project.UpstreamCore).toBe('https://github.com/datarhei/core');
		expect(Project.UpstreamWebsite).toBe('https://datarhei.com');
	});
});
