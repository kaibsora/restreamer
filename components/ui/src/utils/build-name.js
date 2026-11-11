// Copyright 2026 CQComber contributors. SPDX-License-Identifier: Apache-2.0
// A readable build identifier, not a security token. Integer arithmetic keeps
// the result identical across architectures and browser restarts.
const adjectives = ['amber', 'brisk', 'calm', 'clear', 'coral', 'crisp', 'dawn', 'gentle', 'glowing', 'golden', 'lively', 'lunar', 'mint', 'quiet', 'silver', 'swift'];
const nouns = ['brook', 'cedar', 'cloud', 'comet', 'delta', 'fern', 'forest', 'harbor', 'maple', 'meadow', 'orbit', 'otter', 'pine', 'river', 'sparrow', 'willow'];

export function buildName(commit) {
	const seed = String(commit || 'local-development').trim().toLowerCase();
	let hash = 2166136261;
	for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0;
	return `${adjectives[hash % adjectives.length]}-${nouns[(hash >>> 8) % nouns.length]}-${String((hash >>> 16) % 10000).padStart(4, '0')}`;
}
