const nonConstantModes = new Set(['passthrough', 'vfr']);

function addFramerateOptions(options, settings, skills) {
	const supportsFpsMode = skills.ffmpeg.version_major >= 5;

	// FFmpeg rejects -r together with a non-CFR -fps_mode. The selected FPS is
	// still used to calculate GOP settings, but passthrough and VFR must preserve
	// source timestamps instead of requesting output-rate conversion as well.
	if (!supportsFpsMode || !nonConstantModes.has(settings.fps_mode)) {
		options.push('-r', `${settings.fps}`);
	}

	if (supportsFpsMode) {
		options.push('-fps_mode', `${settings.fps_mode}`);
	}

	return options;
}

export { addFramerateOptions };
