import Restreamer from './restreamer';

const createConnectedRestreamer = (ffmpegVersion) => {
	const restreamer = Object.create(Restreamer.prototype);
	restreamer.IsConnected = () => true;
	restreamer.Version = () => ({ number: '16.16.0' });
	restreamer.skills = { ffmpeg: { version: ffmpegVersion } };
	return restreamer;
};

describe('Restreamer runtime compatibility', () => {
	it.each(['5.1.0', '6.1.0', '7.1.1', '8.0.0', '9.0.0'])(
		'accepts supported FFmpeg %s',
		(version) => {
			const compatibility = createConnectedRestreamer(version).Compatibility();

			expect(compatibility.ffmpeg).toMatchObject({
				compatible: true,
				have: version,
				want: '>=5.1.0',
			});
			expect(compatibility.compatible).toBe(true);
		},
	);

	it('rejects FFmpeg below the actual minimum', () => {
		const compatibility = createConnectedRestreamer('5.0.3').Compatibility();

		expect(compatibility.ffmpeg.compatible).toBe(false);
		expect(compatibility.compatible).toBe(false);
	});
});
