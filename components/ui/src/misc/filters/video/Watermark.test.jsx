import { createGraph, defaults, init, summarize } from './Watermark';
import { createInputsOutputs, initProfile } from '../../../utils/metadata';

const channel = '11111111-1111-4111-8111-111111111111';
const image = `/channels/${channel}/watermark.png`;
const textPath = `/channels/${channel}/watermark.txt`;

describe('encoded watermark filter', () => {
	it('is disabled by default', () => {
		expect(defaults()).toEqual({ settings: init({}), graph: '' });
	});

	it('creates a bounded persistent image overlay', () => {
		const graph = createGraph({
			enabled: true,
			image,
			image_position: 'bottom-right',
			image_width: '99999',
			opacity: '2',
			margin: '12',
		});

		expect(graph).toContain(`movie=filename='{diskfs}${image}'`);
		expect(graph).toContain('colorchannelmixer=aa=1.00');
		expect(graph).toContain('scale=1920:-1');
		expect(graph).toContain(
			'overlay=x=W-w-12:y=H-h-12:eof_action=repeat:repeatlast=1',
		);
	});

	it('reads arbitrary channel text from a file instead of interpolating it into the graph', () => {
		const text = `Kai's printer: 50% [ready] — 測試`;
		const graph = createGraph({
			enabled: true,
			text,
			text_path: textPath,
			text_position: 'center',
			font_color: 'yellow',
			font_size: '36',
		});

		expect(graph).toContain(`textfile='{diskfs}${textPath}'`);
		expect(graph).toContain(
			'expansion=none:fontcolor=yellow:fontsize=36:x=(W-tw)/2:y=(H-th)/2',
		);
		expect(graph).not.toContain(text);
		expect(summarize({ enabled: true, text, text_path: textPath })).toBe(
			'Encoded watermark (text)',
		);
	});

	it('downloads CUDA frames before applying software branding', () => {
		const graph = createGraph(
			{ enabled: true, image },
			{ decoder: 'nvdec' },
		);

		expect(graph).toMatch(
			/^\[in\]hwdownload,format=nv12\[watermark_main\];/,
		);
		expect(graph).toContain('[watermark_main][watermark_image]overlay=');
	});

	it('runs branding before the selected hardware encoder upload filters', () => {
		const graph = createGraph({ enabled: true, image });
		const sources = [
			{
				inputs: [{ address: 'rtsp://camera/stream', options: [] }],
				streams: [{ index: 0, stream: 0, type: 'video' }],
			},
		];
		const profile = initProfile({
			video: {
				source: 0,
				stream: 0,
				decoder: { mapping: { global: [], local: [], filter: [] } },
				encoder: {
					coder: 'h264_vaapi',
					mapping: {
						global: [['-vaapi_device', '/dev/dri/renderD128']],
						local: ['-codec:v', 'h264_vaapi'],
						filter: ['format=nv12', 'hwupload'],
					},
				},
				filter: { graph, settings: {} },
			},
		});

		const [, , outputs] = createInputsOutputs(sources, [profile]);
		const filterIndex = outputs[0].options.indexOf('-filter:v');

		expect(outputs[0].options[filterIndex + 1]).toBe(
			`${graph},format=nv12,hwupload`,
		);
		expect(outputs[0].options).toContain('h264_vaapi');
	});

	it('rejects untrusted asset paths from imported metadata', () => {
		expect(
			createGraph({
				enabled: true,
				image: "/tmp/logo.png';movie=/etc/passwd",
			}),
		).toBe('');
		expect(
			createGraph({
				enabled: true,
				text: 'oops',
				text_path: '/etc/passwd',
			}),
		).toBe('');
	});
});
