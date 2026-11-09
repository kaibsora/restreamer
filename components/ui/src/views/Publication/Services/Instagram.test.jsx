import { createOutput } from './Instagram';

test('creates a secure Instagram Live Producer destination', () => {
	const output = createOutput({
		server: 'rtmps://live-upload.instagram.com:443/rtmp/',
		key: 'IG-example-key',
	});

	expect(output).toEqual({
		address: 'rtmps://live-upload.instagram.com:443/rtmp/IG-example-key',
		options: ['-f', 'flv'],
	});
});

test('uses the session-specific server URL supplied by Live Producer', () => {
	const output = createOutput({
		server: '  rtmps://edgetee-upload-fra.example.fbcdn.net:443/rtmp///  ',
		key: ' /IG-session-key  ',
	});

	expect(output.address).toBe(
		'rtmps://edgetee-upload-fra.example.fbcdn.net:443/rtmp/IG-session-key',
	);
});

test('does not invent a destination when the server URL is empty', () => {
	const output = createOutput({ server: ' ', key: 'IG-example-key' });

	expect(output.address).toBe('');
});
