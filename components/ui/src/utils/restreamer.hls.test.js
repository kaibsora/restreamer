import { createInputsOutputs, initProfile } from './metadata';
import Restreamer from './restreamer';

const channelId = '11111111-1111-4111-8111-111111111111';

const createControl = ({ srt = false, version = 7 } = {}) => ({
	process: {
		autostart: true,
		reconnect: true,
		delay: 1,
		staleTimeout: 10,
		low_delay: false,
	},
	limits: {
		cpu_usage: 0,
		memory_mbytes: 0,
		waitfor_seconds: 5,
	},
	rtmp: { enable: false },
	srt: { enable: srt },
	hls: {
		storage: 'memfs',
		master_playlist: true,
		lhls: false,
		version,
		segmentDuration: 2,
		listSize: 6,
		cleanup: true,
	},
});

const createRestreamer = () => {
	const restreamer = Object.create(Restreamer.prototype);
	let savedProcess = null;

	restreamer.GetChannel = () => ({
		id: `restreamer-ui:ingest:${channelId}`,
		channelid: channelId,
		available: false,
	});
	restreamer.ConfigActive = () => ({
		source: {
			network: {
				rtmp: { enabled: true },
				srt: { enabled: true },
			},
		},
	});
	restreamer.GetPublicHTTPAddress = () => 'http://localhost:8080';
	restreamer._upsertProcess = vi.fn(async (_id, process) => {
		savedProcess = process;
		return [process, null];
	});
	restreamer.SetChannel = vi.fn();

	return [restreamer, () => savedProcess];
};

const createOutput = (videoCodec) => ({
	address: '',
	options: ['-map', '0:0', '-codec:v', 'copy', '-an'],
	video_codec: videoCodec,
});

const optionValue = (options, name) => {
	const index = options.indexOf(name);
	return index === -1 ? null : options[index + 1];
};

describe('HLS retention with long camera GOPs', () => {
	it.each([3, 6, 7])('keeps playlists and media valid beyond the requested duration for HLS %s', async (version) => {
		const [restreamer, getSavedProcess] = createRestreamer();
		await restreamer.UpsertIngest(channelId, [], [{ address: '/dev/video4', options: [] }], [createOutput('h264')], createControl({ version }));
		const output = getSavedProcess().output[0];
		// Six 20-second camera segments need a 120-second window, despite
		// hls_time=2. No rule may evict those segments at the old 24-second age.
		expect(output.cleanup.every((rule) => !rule.max_file_age_seconds)).toBe(true);
		expect(output.cleanup.find((rule) => rule.max_files)?.max_files).toBe(12);
		expect(output.cleanup.every((rule) => rule.purge_on_delete)).toBe(true);
		expect(optionValue(output.options, '-hls_flags')).not.toContain('temp_file');
	});
	it('does not impose a finite file count on an unbounded playlist', async () => {
		const [restreamer, getSavedProcess] = createRestreamer();
		const control = createControl();
		control.hls.listSize = 0;
		await restreamer.UpsertIngest(channelId, [], [{ address: '/dev/video4', options: [] }], [createOutput('h264')], control);
		expect(getSavedProcess().output[0].cleanup.every((rule) => !rule.max_files && !rule.max_file_age_seconds)).toBe(true);
	});
	it('keeps atomic file replacement for local disk HLS only', async () => {
		const [restreamer, getSavedProcess] = createRestreamer();
		const control = createControl();
		control.hls.storage = 'diskfs';
		await restreamer.UpsertIngest(channelId, [], [{ address: '/dev/video4', options: [] }], [createOutput('h264')], control);
		expect(optionValue(getSavedProcess().output[0].options, '-hls_flags')).toContain('temp_file');
	});
});

describe('HLS video codec tags', () => {
	it.each([
		['copied HEVC', 'copy', 'hevc', 'hevc'],
		['encoded HEVC', 'libx265', 'h264', 'hevc'],
	])('propagates the output codec for %s', (_name, coder, sourceCodec, expectedCodec) => {
		const sources = [
			{
				inputs: [{ address: 'rtsp://camera.local/stream', options: [] }],
				streams: [{ index: 0, stream: 0, type: 'video', codec: sourceCodec }],
			},
		];
		const profile = initProfile({
			video: {
				source: 0,
				stream: 0,
				decoder: { mapping: { global: [], local: [], filter: [] } },
				encoder: {
					coder,
					mapping: {
						global: [],
						local: ['-codec:v', coder === 'copy' ? 'copy' : 'libx265'],
						filter: [],
					},
				},
				filter: { graph: '', settings: {} },
			},
		});

		const [, , outputs] = createInputsOutputs(sources, [profile]);

		expect(outputs[0].video_codec).toBe(expectedCodec);
	});

	it('marks direct HEVC fragmented-MP4 HLS as hvc1', async () => {
		const [restreamer, getSavedProcess] = createRestreamer();

		const [, err] = await restreamer.UpsertIngest(
			channelId,
			[],
			[{ address: 'rtsp://camera.local/stream', options: [] }],
			[createOutput('hevc')],
			createControl(),
		);

		expect(err).toBeNull();
		const options = getSavedProcess().output[0].options;
		expect(optionValue(options, '-tag:v')).toBe('hvc1');
		expect(optionValue(options, '-hls_segment_type')).toBe('fmp4');
	});

	it('marks HEVC fragmented-MP4 HLS as hvc1 when teeing to SRT', async () => {
		const [restreamer, getSavedProcess] = createRestreamer();

		await restreamer.UpsertIngest(
			channelId,
			[],
			[{ address: 'rtsp://camera.local/stream', options: [] }],
			[createOutput('hevc')],
			createControl({ srt: true }),
		);

		const output = getSavedProcess().output[0];
		expect(optionValue(output.options, '-tag:v')).toBe('hvc1');
		expect(output.address).toContain('[f=mpegts]{srt,');
	});

	it('preserves the existing H.264 tee tag', async () => {
		const [restreamer, getSavedProcess] = createRestreamer();

		await restreamer.UpsertIngest(
			channelId,
			[],
			[{ address: 'rtsp://camera.local/stream', options: [] }],
			[createOutput('h264')],
			createControl({ srt: true }),
		);

		expect(optionValue(getSavedProcess().output[0].options, '-tag:v')).toBe('7');
	});

	it('does not apply an MP4 codec tag to MPEG-TS HLS', async () => {
		const [restreamer, getSavedProcess] = createRestreamer();

		await restreamer.UpsertIngest(
			channelId,
			[],
			[{ address: 'rtsp://camera.local/stream', options: [] }],
			[createOutput('hevc')],
			createControl({ version: 6 }),
		);

		expect(optionValue(getSavedProcess().output[0].options, '-tag:v')).toBeNull();
	});
});
