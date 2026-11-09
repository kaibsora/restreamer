import fs from 'node:fs';
import path from 'node:path';
import videojs from 'video.js';

afterEach(() => {
	document.body.innerHTML = '';
});

test('bundled videojs-overlay works with the current Video.js version', () => {
	document.body.innerHTML = '<video id="player" class="video-js"></video>';

	window.videojs = videojs;
	const pluginSource = fs.readFileSync(path.join(process.cwd(), 'public/_player/videojs/dist/videojs-overlay.min.js'), 'utf8');
	window.eval(pluginSource);

	const player = videojs('player');
	const img = new Image();
	img.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="10" height="10"%3E%3C/svg%3E';

	expect(() => {
		player.overlay({
			align: 'top-right',
			overlays: [
				{
					showBackground: false,
					content: img.outerHTML,
					start: 'playing',
					end: 'pause',
				},
			],
		});
	}).not.toThrow();

	player.trigger('playing');

	const rendered = document.querySelector('.vjs-overlay img');
	expect(rendered).not.toBeNull();
	expect(rendered.getAttribute('src')).toContain('data:image/svg+xml');

	player.dispose();
});
