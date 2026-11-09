import { v4 as uuidv4 } from 'uuid';

const BUNDLE_TYPE = 'restreamer-channel-bundle';
const BUNDLE_VERSION = 2;
const SUPPORTED_BUNDLE_VERSIONS = new Set([1, BUNDLE_VERSION]);
const MAX_ASSET_BYTES = 1024 * 1024;
const MAX_TOTAL_ASSET_BYTES = 3 * MAX_ASSET_BYTES;
const INGEST_PREFIX = 'restreamer-ui:ingest:';
const EGRESS_PATTERN = /^restreamer-ui:egress:([0-9a-z]+):[0-9a-f-]+$/;

const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

const rewriteStrings = (value, replacements) => {
	if (typeof value === 'string') {
		return replacements.reduce((result, [from, to]) => result.split(from).join(to), value);
	}

	if (Array.isArray(value)) {
		return value.map((item) => rewriteStrings(item, replacements));
	}

	if (isObject(value)) {
		return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteStrings(item, replacements)]));
	}

	return value;
};

const validateProcess = (process) => {
	if (!isObject(process) || typeof process.id !== 'string' || !isObject(process.config) || process.config.id !== process.id) {
		throw new Error('The bundle contains an invalid process');
	}

	if (!isObject(process.metadata)) {
		throw new Error(`The process "${process.id}" has invalid metadata`);
	}
};

const validateAssets = (bundle) => {
	if (bundle.version === 1 && bundle.assets === undefined) {
		return;
	}

	if (!Array.isArray(bundle.assets)) {
		throw new Error('The bundle contains an invalid asset list');
	}

	const prefix = `/channels/${bundle.channel.id}/`;
	const paths = new Set();
	let totalBytes = 0;
	for (const asset of bundle.assets) {
		if (!isObject(asset) || typeof asset.path !== 'string' || !asset.path.startsWith(prefix)) {
			throw new Error('The bundle contains an invalid channel asset path');
		}

		const name = asset.path.substring(prefix.length);
		if (!/^(?:(?:logo|poster)\.(?:gif|jpe?g|png|svg)|watermark\.(?:jpe?g|png|txt))$/i.test(name) || name.includes('..')) {
			throw new Error(`The bundle contains unsupported channel asset "${name}"`);
		}

		if (paths.has(asset.path)) {
			throw new Error(`The bundle contains duplicate asset "${asset.path}"`);
		}
		paths.add(asset.path);

		if (
			asset.encoding !== 'base64' ||
			typeof asset.data !== 'string' ||
			asset.data.length === 0 ||
			asset.data.length % 4 !== 0 ||
			!/^[A-Za-z0-9+/]*={0,2}$/.test(asset.data)
		) {
			throw new Error(`The bundle contains invalid data for asset "${name}"`);
		}
		if (
			asset.content_type !== undefined &&
			(typeof asset.content_type !== 'string' || !/^(?:image\/(?:gif|jpeg|png|svg\+xml)|text\/plain(?:;charset=utf-8)?)$/.test(asset.content_type))
		) {
			throw new Error(`The bundle contains an invalid content type for asset "${name}"`);
		}

		const bytes = Math.floor((asset.data.length * 3) / 4) - (asset.data.endsWith('==') ? 2 : asset.data.endsWith('=') ? 1 : 0);
		if (bytes > MAX_ASSET_BYTES) {
			throw new Error(`The channel asset "${name}" is larger than 1 MB`);
		}
		totalBytes += bytes;
	}

	if (totalBytes > MAX_TOTAL_ASSET_BYTES) {
		throw new Error('The channel assets are larger than 3 MB in total');
	}
};

const validateBundle = (bundle) => {
	if (!isObject(bundle) || bundle.type !== BUNDLE_TYPE || !SUPPORTED_BUNDLE_VERSIONS.has(bundle.version)) {
		throw new Error('This is not a supported Restreamer channel bundle');
	}

	if (!isObject(bundle.channel) || typeof bundle.channel.id !== 'string' || typeof bundle.channel.name !== 'string') {
		throw new Error('The bundle has no valid channel description');
	}

	if (!Array.isArray(bundle.processes) || bundle.processes.length === 0) {
		throw new Error('The bundle contains no processes');
	}

	for (const process of bundle.processes) {
		validateProcess(process);
	}

	validateAssets(bundle);

	const ingestId = `${INGEST_PREFIX}${bundle.channel.id}`;
	if (!bundle.processes.some((process) => process.id === ingestId && process.config.reference === bundle.channel.id)) {
		throw new Error('The bundle does not contain its channel ingest process');
	}

	const ids = new Set();
	for (const process of bundle.processes) {
		if (ids.has(process.id)) {
			throw new Error(`The bundle contains duplicate process ID "${process.id}"`);
		}
		ids.add(process.id);

		const isIngest = process.id === ingestId;
		const isSnapshot = process.id === `${ingestId}_snapshot`;
		const isEgress = EGRESS_PATTERN.test(process.id);
		if ((!isIngest && !isSnapshot && !isEgress) || process.config.reference !== bundle.channel.id) {
			throw new Error(`The process "${process.id}" does not belong to this channel`);
		}
	}
};

const createChannelBundle = (channel, processes, assets = [], exportedAt = new Date().toISOString()) => {
	const bundle = {
		type: BUNDLE_TYPE,
		version: BUNDLE_VERSION,
		exported_at: exportedAt,
		channel: {
			id: channel.channelid,
			name: channel.name || '',
		},
		processes: processes.map((process) => ({
			id: process.id,
			config: process.config,
			metadata: process.metadata || {},
		})),
		assets,
	};

	validateBundle(bundle);
	return bundle;
};

const prepareChannelImport = (bundle, makeUuid = uuidv4) => {
	validateBundle(bundle);

	const oldChannelId = bundle.channel.id;
	const newChannelId = makeUuid();
	const oldIngestId = `${INGEST_PREFIX}${oldChannelId}`;
	const newIngestId = `${INGEST_PREFIX}${newChannelId}`;
	const idMap = new Map([
		[oldIngestId, newIngestId],
		[`${oldIngestId}_snapshot`, `${newIngestId}_snapshot`],
	]);

	for (const process of bundle.processes) {
		const match = EGRESS_PATTERN.exec(process.id);
		if (match !== null) {
			idMap.set(process.id, `restreamer-ui:egress:${match[1]}:${makeUuid()}`);
		}
	}

	const replacements = [...idMap.entries(), [oldChannelId, newChannelId]].sort((a, b) => b[0].length - a[0].length);
	const processes = bundle.processes.map((process) => {
		const id = idMap.get(process.id);
		const config = rewriteStrings(process.config, replacements);
		config.id = id;
		config.reference = newChannelId;

		return {
			id,
			config,
			metadata: rewriteStrings(process.metadata, replacements),
		};
	});
	const assets = (bundle.assets || []).map((asset) => ({
		...asset,
		path: rewriteStrings(asset.path, [[oldChannelId, newChannelId]]),
	}));

	return {
		channel: {
			id: newChannelId,
			name: bundle.channel.name,
		},
		processes,
		assets,
	};
};

export { BUNDLE_TYPE, BUNDLE_VERSION, createChannelBundle, prepareChannelImport, validateBundle };
