import { func as camera } from '../Sources/V4L';
import { t } from '@lingui/core/macro';

function matches(source, res) {
	const video = res?.streams?.find((stream) => stream.type === 'video');
	if (!video) return false;
	const requested = source.settings;
	if (['h264', 'mjpeg', 'hevc'].includes(requested.format) && video.codec !== requested.format) return false;
	if (requested.size !== 'auto') {
		const [width, height] = requested.size.split('x').map(Number);
		if (video.width !== width || video.height !== height) return false;
	}
	return true;
}

// Prefer native H.264, then MJPEG when advertised. Keep the resolved mode in the
// saved source too, so verification and subsequent streaming use identical input
// options. Cameras without MJPEG fall back to their native automatic mode.
export async function probeSource(probe, source, getModes) {
	if (source.type === 'video4linux2' && source.settings.format === 'auto') {
		let preferred = ['mjpeg'];
		if (getModes) {
			try {
				const [formats, error] = await getModes(source.inputs[0].address);
				if (!error && formats?.length) preferred = ['h264', 'mjpeg'].filter((format) => formats.some((mode) => mode.input_format === format));
			} catch {
				/* Older backends keep the existing MJPEG probe fallback. */
			}
		}
		for (const format of preferred) {
			const settings = { ...source.settings, format };
			const inputs = camera.createInputs(settings);
			const [res, err] = await probe(inputs);
			if (err === null && matches({ ...source, settings }, res)) {
				return { source: { ...source, settings, inputs }, res, err };
			}
		}
	}
	if (source.type === 'video4linux2' && source.settings.format === 'auto' && source.settings.auto_format) {
		source = { ...source, settings: { ...source.settings, auto_format: '' } };
		source.inputs = camera.createInputs(source.settings);
	}
	const [res, err] = await probe(source.inputs);
	if (!err && source.type === 'video4linux2' && !matches(source, res))
		return {
			source,
			res,
			err: { message: t`The camera did not supply the requested capture format and resolution. Choose an advertised mode and verify again.` },
		};
	return { source, res, err };
}
