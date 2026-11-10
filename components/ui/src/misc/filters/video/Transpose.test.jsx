import { createGraph, hwaccel } from './Transpose';
import { createInputsOutputs, initProfile } from '../../../utils/metadata';

test.each([
	['none', ''],
	['90', 'transpose=dir=clock:passthrough=none'],
	[
		'180',
		'transpose=dir=clock:passthrough=none,transpose=dir=clock:passthrough=none',
	],
	['270', 'transpose=dir=cclock:passthrough=none'],
])('maps rotation %s into encoded frames', (value, graph) => {
	expect(createGraph({ value })).toBe(graph);
});

test.each(['h264_vaapi', 'h264_qsv'])(
	'rotation precedes %s encoding and remains available in hardware mode',
	(coder) => {
		expect(hwaccel).toBe(true);
		const sources = [
			{
				inputs: [{ address: '/dev/video0', options: [] }],
				streams: [{ index: 0, stream: 0, type: 'video' }],
			},
		];
		const graph = createGraph({ value: '90' });
		const filters =
			coder === 'h264_vaapi'
				? ['format=nv12', 'hwupload']
				: ['format=nv12'];
		const profile = initProfile({
			video: {
				source: 0,
				stream: 0,
				decoder: { mapping: { global: [], local: [], filter: [] } },
				encoder: {
					coder,
					mapping: {
						global: [],
						local: ['-codec:v', coder],
						filter: filters,
					},
				},
				filter: { graph, settings: {} },
			},
		});
		const [, , outputs] = createInputsOutputs(sources, [profile]);
		const index = outputs[0].options.indexOf('-filter:v');
		expect(outputs[0].options[index + 1]).toBe(
			[graph, ...filters].join(','),
		);
	},
);

test('CUDA rotation downloads frames once before software rotation', () => {
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
			decoder: {
				coder: 'nvdec',
				mapping: { global: [], local: [], filter: [] },
			},
			encoder: {
				coder: 'h264_nvenc',
				mapping: { global: [], local: [], filter: [] },
			},
			filter: { graph: createGraph({ value: '90' }), settings: {} },
		},
	});
	const [, , outputs] = createInputsOutputs(sources, [profile]);
	const index = outputs[0].options.indexOf('-filter:v');
	expect(outputs[0].options[index + 1]).toBe(
		'hwdownload,format=nv12,transpose=dir=clock:passthrough=none',
	);
});
