import React from 'react';
import { render, fireEvent, screen, waitFor } from '../../utils/testing';
import Main from './index';
import { cameraDevices } from './LiveCameraControls';
import * as M from '../../utils/metadata';

vi.mock('../../misc/Player', () => ({ default: () => <video aria-label="Live preview" /> }));
vi.mock('./Publication', () => ({ default: () => null }));
vi.mock('../../misc/modals/Process', () => ({ default: () => null }));
vi.mock('../../misc/modals/Debug', () => ({ default: () => null }));

const brightness = { id: 10, name: 'Brightness', type: 'integer', minimum: 0, maximum: 255, step: 1, value: 128, supported: true, choices: [] };
const usb = (address) => ({ type: 'video4linux2', inputs: [{ address }] });

test('finds only profile-selected video cameras, deduplicates inputs and preserves stable aliases', () => {
	expect(cameraDevices({
		sources: [usb('/dev/video0'), { type: 'network', inputs: [{ address: 'rtsp://camera/live' }] }, usb('/dev/v4l/by-id/camera')],
		profiles: [{ video: { source: 2 } }, { video: { source: 2 } }, { video: { source: 1 } }],
	})).toEqual(['/dev/v4l/by-id/camera']);
	expect(cameraDevices({ sources: [usb('/dev/video0')], profiles: [{ audio: { source: 0 } }] })).toEqual([]);
	expect(cameraDevices(null)).toEqual([]);
});

function setup(type = 'video4linux2') {
	const metadata = M.initIngestMetadata({ sources: [{ type, inputs: [{ address: type === 'network' ? 'rtsp://camera/live' : '/dev/video2' }] }], profiles: [{ video: { source: 0 } }] });
	metadata.control.rtmp.enable = false;
	metadata.control.srt.enable = false;
	const restreamer = {
		GetIngestMetadata: vi.fn().mockResolvedValue(metadata), SelectChannel: () => 'camera',
		GetChannel: () => ({ available: true, name: 'Camera' }),
		GetIngestProgress: vi.fn().mockResolvedValue({ valid: true, state: 'connected', time: 10, bitrate: 1000, fps: 15, speed: 1, reconnect: -1 }),
		ConfigActive: () => ({}), GetChannelAddress: () => '/live.m3u8', GetPublicAddress: () => '/live.m3u8',
		CameraControls: vi.fn().mockResolvedValue([[brightness], null]),
		SetCameraControl: vi.fn().mockResolvedValue([[{ ...brightness, value: 129 }], null]),
		StopIngest: vi.fn(), StartIngest: vi.fn(), SetIngestMetadata: vi.fn(),
	};
	render(<Main restreamer={restreamer} />, undefined, '/camera', '/:channelid');
	return restreamer;
}

test('live dashboard applies a control without restarting capture, saving metadata or replacing its player', async () => {
	const restreamer = setup();
	const player = await screen.findByLabelText('Live preview');
	fireEvent.click(await screen.findByText('Camera controls'));
	const field = await screen.findByRole('slider', { name: 'Brightness' });
	fireEvent.change(field, { target: { value: '129' } });
	await waitFor(() => expect(restreamer.SetCameraControl).toHaveBeenCalledWith('/dev/video2', 10, 129));
	expect(screen.queryByRole('button', { name: 'Brightness' })).not.toBeInTheDocument();
	expect(screen.getByLabelText('Live preview')).toBe(player);
	expect(restreamer.StopIngest).not.toHaveBeenCalled();
	expect(restreamer.StartIngest).not.toHaveBeenCalled();
	expect(restreamer.SetIngestMetadata).not.toHaveBeenCalled();
});

test('network channels retain their player without advertising local USB controls', async () => {
	const restreamer = setup('network');
	await screen.findByLabelText('Live preview');
	expect(screen.queryByText('Camera controls')).not.toBeInTheDocument();
	expect(restreamer.CameraControls).not.toHaveBeenCalled();
});
