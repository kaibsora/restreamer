/**
 * Normalize the RTMP application used as a URL path prefix.
 *
 * Core stores the root application as "/", while URL construction needs an
 * empty prefix for the same value. Non-root applications are returned with one
 * leading slash and without a trailing slash.
 */
const normalizeRTMPApp = (app) => {
	let normalized = String(app ?? '').replace(/\/+/g, '/');

	while (normalized.endsWith('/') && normalized.length > 1) {
		normalized = normalized.slice(0, -1);
	}

	if (normalized === '' || normalized === '/') {
		return '';
	}

	if (!normalized.startsWith('/')) {
		normalized = '/' + normalized;
	}

	return normalized;
};

const normalizeRTMPAppConfig = (app) => normalizeRTMPApp(app) || '/';

export { normalizeRTMPApp, normalizeRTMPAppConfig };
