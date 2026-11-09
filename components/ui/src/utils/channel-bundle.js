import { v4 as uuidv4 } from 'uuid';

const BUNDLE_TYPE = 'restreamer-channel-bundle';
const BUNDLE_VERSION = 1;
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

const validateBundle = (bundle) => {
	if (!isObject(bundle) || bundle.type !== BUNDLE_TYPE || bundle.version !== BUNDLE_VERSION) {
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

const createChannelBundle = (channel, processes, exportedAt = new Date().toISOString()) => {
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

	return {
		channel: {
			id: newChannelId,
			name: bundle.channel.name,
		},
		processes,
	};
};

export { BUNDLE_TYPE, BUNDLE_VERSION, createChannelBundle, prepareChannelImport, validateBundle };
