import React from 'react';
import { render, fireEvent, screen, waitFor } from '../utils/testing';
import CameraCapture from './CameraCapture';

const formats = [
	{
		fourcc: 'H264',
		name: 'H.264',
		input_format: 'h264',
		sizes: [
			{ width: 640, height: 480, frame_rates: ['30', '15'] },
			{ width: 1920, height: 1080, frame_rates: ['30'] },
		],
	},
	{
		fourcc: 'YUYV',
		name: 'YUYV',
		input_format: 'yuyv422',
		sizes: [{ width: 2304, height: 1536, frame_rates: ['2'] }],
	},
];

test('offers only driver-reported sizes for the selected format and resets dependent capture settings', async () => {
	const restreamer = {
		CameraModes: vi.fn().mockResolvedValue([formats, null]),
	};
	const onChange = vi.fn();
	const settings = { format: 'h264', size: '640x480', framerate: '30' };
	const { rerender } = render(
		<CameraCapture
			device="/dev/video4"
			restreamer={restreamer}
			settings={settings}
			onChange={onChange}
		/>,
	);
	await waitFor(() =>
		expect(screen.getAllByRole('combobox')[0]).toHaveTextContent('H.264'),
	);
	fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
	expect(
		screen.getByRole('option', { name: '1920×1080' }),
	).toBeInTheDocument();
	expect(
		screen.queryByRole('option', { name: '2304×1536' }),
	).not.toBeInTheDocument();
	fireEvent.click(screen.getByRole('option', { name: '1920×1080' }));
	expect(onChange).toHaveBeenLastCalledWith({
		...settings,
		size: '1920x1080',
		framerate: 'auto',
	});
	rerender(
		<CameraCapture
			device="/dev/video4"
			restreamer={restreamer}
			settings={{ ...settings, size: '1920x1080', framerate: 'auto' }}
			onChange={onChange}
		/>,
	);
	fireEvent.mouseDown(screen.getAllByRole('combobox')[2]);
	expect(screen.getByRole('option', { name: '30 FPS' })).toBeInTheDocument();
	expect(
		screen.queryByRole('option', { name: '15 FPS' }),
	).not.toBeInTheDocument();
});
