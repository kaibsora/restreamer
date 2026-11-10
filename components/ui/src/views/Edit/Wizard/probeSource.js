import { func as camera } from '../Sources/V4L';

// Prefer compressed USB capture when available. Keep the resolved mode in the
// saved source too, so verification and subsequent streaming use identical input
// options. Cameras without MJPEG fall back to their native automatic mode.
export async function probeSource(probe, source) {
	if (source.type === 'video4linux2' && source.settings.format === 'auto') {
		const settings = { ...source.settings, format: 'mjpeg' };
		const inputs = camera.createInputs(settings);
		const [res, err] = await probe(inputs);
		if (err === null && res?.streams?.some((stream) => stream.type === 'video' && stream.codec === 'mjpeg')) {
			return { source: { ...source, settings, inputs }, res, err };
		}
	}
	const [res, err] = await probe(source.inputs);
	return { source, res, err };
}
