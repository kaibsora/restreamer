import React from 'react';
import { render, fireEvent, act, screen } from '../../../utils/testing';
import '@testing-library/jest-dom';

import Wizard from './index';

const restreamer = {
	SelectChannel: () => {
		return 'test';
	},
	GetChannel: () => {
		return {
			id: 'test',
			name: 'test',
		};
	},
	Skills: () => {
		return {
			ffmpeg: {
				version: '5.1.2',
				version_major: 5,
				version_minor: 1,
			},
			formats: {
				demuxers: ['rtsp'],
			},
			protocols: {
				input: ['http', 'https', 'rtmp', 'rtmps', 'srt'],
			},
			sources: {
				network: [],
			},
			encoders: {
				audio: ['copy', 'none', 'aac'],
				video: ['copy', 'none', 'libx264'],
			},
			decoders: {
				audio: ['default'],
				video: ['default'],
			},
		};
	},
	RefreshSkills: () => {},
	ConfigActive: () => {
		return {
			source: {
				network: {
					rtmp: {
						enabled: true,
						app: '/live',
						token: 'foobar',
					},
					srt: {
						enabled: true,
						token: 'foobar',
						passphrase: 'bazfoobazfoo',
					},
				},
			},
		};
	},
	Probe: (id, inputs) => {
		let streams = [];

		if (inputs[0].address === '{rtmp,name=external.stream}') {
			streams.push({
				url: inputs[0].address,
				format: 'rtmp',
				index: 0,
				stream: 0,
				language: 'und',
				type: 'video',
				codec: 'h264',
				coder: '',
				bitrate_kbps: 0,
				duration_sec: 0,
				fps: 0,
				pix_fmt: 'yuvj420p',
				width: 1280,
				height: 720,
				sampling_hz: 0,
				layout: '',
				channels: 0,
			});
			streams.push({
				url: inputs[0].address,
				format: 'rtmp',
				index: 0,
				stream: 1,
				language: 'und',
				type: 'audio',
				codec: 'aac',
				coder: '',
				bitrate_kbps: 0,
				duration_sec: 0,
				fps: 0,
				pix_fmt: 'yuvj420p',
				width: 1280,
				height: 720,
				sampling_hz: 44100,
				layout: 'stereo',
				channels: 2,
			});
		} else if (inputs[0].address === '{srt,name=external.stream,mode=request}') {
			streams.push({
				url: inputs[0].address,
				format: 'srt',
				index: 0,
				stream: 0,
				language: 'und',
				type: 'video',
				codec: 'h264',
				coder: '',
				bitrate_kbps: 0,
				duration_sec: 0,
				fps: 0,
				pix_fmt: 'yuvj420p',
				width: 1280,
				height: 720,
				sampling_hz: 0,
				layout: '',
				channels: 0,
			});
			streams.push({
				url: inputs[0].address,
				format: 'srt',
				index: 0,
				stream: 1,
				language: 'und',
				type: 'audio',
				codec: 'aac',
				coder: '',
				bitrate_kbps: 0,
				duration_sec: 0,
				fps: 0,
				pix_fmt: 'yuvj420p',
				width: 1280,
				height: 720,
				sampling_hz: 44100,
				layout: 'stereo',
				channels: 2,
			});
		} else if (inputs[0].address === 'anullsrc=r=44100:cl=stereo') {
			streams.push({
				url: inputs[0].address,
				format: 'lavfi',
				index: 0,
				stream: 0,
				language: 'und',
				type: 'audio',
				codec: 'pcm',
				coder: '',
				bitrate_kbps: 0,
				duration_sec: 0,
				fps: 0,
				pix_fmt: 'yuvj420p',
				width: 1280,
				height: 720,
				sampling_hz: 44100,
				layout: 'stereo',
				channels: 2,
			});
		} else {
			const name = inputs[0].address.split('/').pop();
			const [video, audio] = name.split('-');

			switch (video) {
				case 'none':
					break;
				case 'h264':
					streams.push({
						url: 'rtsp://127.0.0.1/live/stream',
						format: 'rtsp',
						index: 0,
						stream: 0,
						language: 'und',
						type: 'video',
						codec: 'h264',
						coder: '',
						bitrate_kbps: 0,
						duration_sec: 0,
						fps: 0,
						pix_fmt: 'yuvj420p',
						width: 1280,
						height: 720,
						sampling_hz: 0,
						layout: '',
						channels: 0,
					});
					break;
				case 'other':
					streams.push({
						url: 'rtsp://127.0.0.1/live/stream',
						format: 'rtsp',
						index: 0,
						stream: 0,
						language: 'und',
						type: 'video',
						codec: 'mjpeg',
						coder: '',
						bitrate_kbps: 0,
						duration_sec: 0,
						fps: 0,
						pix_fmt: 'yuvj420p',
						width: 1280,
						height: 720,
						sampling_hz: 0,
						layout: '',
						channels: 0,
					});
					break;
				case 'unknown':
					streams.push({
						url: 'rtsp://127.0.0.1/live/stream',
						format: 'rtsp',
						index: 0,
						stream: 0,
						language: 'und',
						type: 'video',
						codec: 'xxx',
						coder: '',
						bitrate_kbps: 0,
						duration_sec: 0,
						fps: 0,
						pix_fmt: 'yuvj420p',
						width: 1280,
						height: 720,
						sampling_hz: 0,
						layout: '',
						channels: 0,
					});
					break;
				default:
					break;
			}

			switch (audio) {
				case 'none':
					break;
				case 'aac':
					streams.push({
						url: 'rtsp://127.0.0.1/live/stream',
						format: 'rtsp',
						index: 0,
						stream: 1,
						language: 'und',
						type: 'audio',
						codec: 'aac',
						coder: '',
						bitrate_kbps: 0,
						duration_sec: 0,
						fps: 0,
						pix_fmt: 'yuvj420p',
						width: 1280,
						height: 720,
						sampling_hz: 44100,
						layout: 'stereo',
						channels: 2,
					});
					break;
				case 'ogg':
					streams.push({
						url: 'rtsp://127.0.0.1/live/stream',
						format: 'rtsp',
						index: 0,
						stream: 1,
						language: 'und',
						type: 'audio',
						codec: 'ogg',
						coder: '',
						bitrate_kbps: 0,
						duration_sec: 0,
						fps: 0,
						pix_fmt: 'yuvj420p',
						width: 1280,
						height: 720,
						sampling_hz: 44100,
						layout: 'stereo',
						channels: 2,
					});
					break;
				case 'unknown':
					streams.push({
						url: 'rtsp://127.0.0.1/live/stream',
						format: 'rtsp',
						index: 0,
						stream: 1,
						language: 'und',
						type: 'audio',
						codec: 'xxx',
						coder: '',
						bitrate_kbps: 0,
						duration_sec: 0,
						fps: 0,
						pix_fmt: 'yuvj420p',
						width: 1280,
						height: 720,
						sampling_hz: 44100,
						layout: 'stereo',
						channels: 2,
					});
					break;
				default:
					break;
			}
		}

		return [{ streams: streams }, null];
	},
	UpsertIngest: (_channelid, global, inputs, outputs, control) => {
		return [{}, null];
	},
	SetIngestMetadata: (_channelid, data) => {},
	UpsertIngestSnapshot: (_channelid, control) => {},
	UpdatePlayer: (_channelid) => {},
	UpdatePlayersite: () => {},
};

test('wizard', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	expect(await screen.findByText(/Select whether you pull the stream from a/)).toBeInTheDocument();

	expect(screen.queryByText('Network source')).toBeInTheDocument();
	expect(screen.queryByText('RTMP server')).toBeInTheDocument();
	expect(screen.queryByText('SRT server')).toBeInTheDocument();
});

test('wizard: rtmp source video h264-aac', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'RTMP server' });
	fireEvent.click(button);

	expect(screen.queryByText(/Address:/)).toBeInTheDocument();

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The video source is compatible. Select the detected video track:/)).toBeInTheDocument();
	expect(screen.queryByText(/Your stream needs to be encoded. Choose the desired encoder:/)).not.toBeInTheDocument();

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Audio from device/)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();

	// Confirm selected audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();

	// Confirm metadata
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/License/)).toBeInTheDocument();

	// Confirm license
	button = screen.getByRole('button', { name: 'Save' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});
});

test('wizard: srt source video h264-aac', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'SRT server' });
	fireEvent.click(button);

	expect(screen.queryByText(/Address:/)).toBeInTheDocument();

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The video source is compatible. Select the detected video track:/)).toBeInTheDocument();
	expect(screen.queryByText(/Your stream needs to be encoded. Choose the desired encoder:/)).not.toBeInTheDocument();

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Audio from device/)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();

	// Confirm selected audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();

	// Confirm metadata
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/License/)).toBeInTheDocument();

	// Confirm license
	button = screen.getByRole('button', { name: 'Save' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});
});

test('wizard: network source error', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/none-none' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Failed to verify the source. Please check the address./)).toBeInTheDocument();

	// Add a stream address
	input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/none-aac' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The source doesn't provide any video streams. Please check the device./)).toBeInTheDocument();

	/*
    // TODO: This message appears only if there's no h264 encoder. However it should appear if there's no
    //       suitable decoder for the detected codec. The question is, if this is actually possible, because
    //       if FFmpeg doesn't know the codec, how can it detect it?

	input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/unknown-none' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The source doesn't provide any compatible video streams./)).toBeInTheDocument();
    */
});

test('wizard: network source video h264', async () => {
	const upserts = [];
	const savingRestreamer = {
		...restreamer,
		UpsertIngest: (_channelid, global, inputs, outputs, control) => {
			upserts.push({ global, inputs, outputs, control });
			return [{}, null];
		},
	};

	await act(async () => {
		render(<Wizard restreamer={savingRestreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-none' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The video source is compatible. Select the detected video track:/)).toBeInTheDocument();
	expect(screen.queryByText(/Your stream needs to be encoded. Choose the desired encoder:/)).not.toBeInTheDocument();

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The video source doesn't provide any compatible audio stream./)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();
	expect(screen.queryByLabelText('Silence Audio')).toBeChecked();

	// Keep the suggested silence track and save the complete process.
	button = screen.getByRole('button', { name: 'Next' });
	await act(async () => {
		fireEvent.click(button);
	});

	button = screen.getByRole('button', { name: 'Next' });
	await act(async () => {
		fireEvent.click(button);
	});

	button = screen.getByRole('button', { name: 'Save' });
	await act(async () => {
		fireEvent.click(button);
	});

	expect(upserts).toHaveLength(1);
	expect(upserts[0].inputs).toHaveLength(2);
	expect(upserts[0].inputs[1].address).toBe('anullsrc=r=44100:cl=stereo');

	const options = upserts[0].outputs[0].options;
	const mapTargets = options.filter((_, index) => options[index - 1] === '-map');
	expect(mapTargets).toEqual(['0:0', '1:0']);
	expect(options[options.indexOf('-codec:a') + 1]).toBe('aac');
});

test('wizard: network source video non-h264', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/other-none' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The video source is compatible. Select the detected video track:/)).toBeInTheDocument();
	expect(screen.queryByText(/Your stream needs to be encoded. Choose the desired encoder:/)).toBeInTheDocument();

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/The video source doesn't provide any compatible audio stream./)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();
});

test('wizard: network source audio aac', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-aac' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Audio from device/)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();

	// Select suggested audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();
});

test('wizard: network source audio non-aac', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-ogg' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Audio from device/)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();

	// Select suggested audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();
});

test('wizard: network source silence audio', async () => {
	const upserts = [];
	const savingRestreamer = {
		...restreamer,
		UpsertIngest: (_channelid, global, inputs, outputs, control) => {
			upserts.push({ global, inputs, outputs, control });
			return [{}, null];
		},
	};

	await act(async () => {
		render(<Wizard restreamer={savingRestreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-aac' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Audio from device/)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();

	expect(screen.queryByLabelText('Audio from device')).toBeChecked();
	expect(screen.queryByLabelText('Silence Audio')).not.toBeChecked();
	expect(screen.queryByLabelText('No audio')).not.toBeChecked();

	input = screen.queryByLabelText('Silence Audio');

	await act(async () => {
		fireEvent.click(input);
	});

	expect(screen.queryByLabelText('Audio from device')).not.toBeChecked();
	expect(screen.queryByLabelText('Silence Audio')).toBeChecked();
	expect(screen.queryByLabelText('No audio')).not.toBeChecked();

	// Confirm selected audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();

	// Confirm metadata and license so the generated FFmpeg process is saved.
	button = screen.getByRole('button', { name: 'Next' });
	await act(async () => {
		fireEvent.click(button);
	});

	button = screen.getByRole('button', { name: 'Save' });
	await act(async () => {
		fireEvent.click(button);
	});

	expect(upserts).toHaveLength(1);
	expect(upserts[0].inputs).toHaveLength(2);
	expect(upserts[0].inputs[0].address).toBe('rtsp://127.0.0.1/live/h264-aac');
	expect(upserts[0].inputs[1].address).toBe('anullsrc=r=44100:cl=stereo');
	expect(upserts[0].outputs).toHaveLength(1);

	const options = upserts[0].outputs[0].options;
	const mapTargets = options.filter((_, index) => options[index - 1] === '-map');
	expect(mapTargets).toEqual(['0:0', '1:0']);
});

test('wizard: network source no audio', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-aac' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Audio from device/)).toBeInTheDocument();
	expect(screen.queryByText(/Silence Audio/)).toBeInTheDocument();
	expect(screen.queryByText(/No audio/)).toBeInTheDocument();

	expect(screen.queryByLabelText('Audio from device')).toBeChecked();
	expect(screen.queryByLabelText('Silence Audio')).not.toBeChecked();
	expect(screen.queryByLabelText('No audio')).not.toBeChecked();

	input = screen.queryByLabelText('No audio');

	await act(async () => {
		fireEvent.click(input);
	});

	expect(screen.queryByLabelText('Audio from device')).not.toBeChecked();
	expect(screen.queryByLabelText('Silence Audio')).not.toBeChecked();
	expect(screen.queryByLabelText('No audio')).toBeChecked();

	// Confirm selected audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();
});

test('wizard: metadata', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-aac' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Confirm selected audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/Metadata/)).toBeInTheDocument();
	expect(screen.queryByLabelText('Name')).toHaveValue('test');
	expect(screen.queryByLabelText('Description')).toHaveValue('Live from earth. Powered by datarhei Restreamer.');

	// Confirm metadata
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/License/)).toBeInTheDocument();
});

test('wizard: license', async () => {
	await act(async () => {
		render(<Wizard restreamer={restreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	// Choose network source
	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeDisabled();

	// Add a stream address
	let input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-aac' } });

	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Select suggested video stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Confirm selected audio stream
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	// Confirm metadata
	button = screen.getByRole('button', { name: 'Next' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.queryByText(/License/)).toBeInTheDocument();

	// Confirm license
	button = screen.getByRole('button', { name: 'Save' });
	expect(button).toBeEnabled();

	await act(async () => {
		fireEvent.click(button);
	});
});

test('wizard: save failure shows an error and allows retry', async () => {
	const failingRestreamer = {
		...restreamer,
		UpsertIngest: () => [null, new Error('ingest save failed')],
	};

	await act(async () => {
		render(<Wizard restreamer={failingRestreamer} />, {}, '/wizard/test', '/wizard/:channelid');
	});

	let button = screen.getByRole('button', { name: 'Network source' });
	fireEvent.click(button);

	const input = screen.getByLabelText('Address');
	fireEvent.change(input, { target: { value: 'rtsp://127.0.0.1/live/h264-aac' } });

	for (let step = 0; step < 4; step++) {
		button = screen.getByRole('button', { name: 'Next' });
		await act(async () => {
			fireEvent.click(button);
		});
	}

	button = screen.getByRole('button', { name: 'Save' });
	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.getByText('There was an error setting up the stream.')).toBeInTheDocument();

	button = screen.getByRole('button', { name: 'Retry' });
	await act(async () => {
		fireEvent.click(button);
	});

	expect(screen.getByText('Network source')).toBeInTheDocument();
});
