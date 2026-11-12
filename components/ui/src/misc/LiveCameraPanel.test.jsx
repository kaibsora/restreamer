import React from 'react';
import { render, fireEvent, screen, waitFor } from '../utils/testing';
import CameraControls from './CameraControls';

const brightness = { id: 10, name: 'Brightness', type: 'integer', minimum: -64, maximum: 64, step: 2, value: 0, supported: true, choices: [] };

test('live sliders use driver limits and apply keyboard changes without an Apply button', async () => {
	const restreamer = { CameraControls: vi.fn().mockResolvedValue([[brightness], null]), SetCameraControl: vi.fn().mockResolvedValue([[{ ...brightness, value: 2 }], null]) };
	render(<CameraControls live device="/dev/video2" restreamer={restreamer} />);
	expect(restreamer.CameraControls).not.toHaveBeenCalled();
	fireEvent.click(screen.getByText('Camera controls'));
	const slider = await screen.findByRole('slider', { name: 'Brightness' });
	expect(slider).toHaveAttribute('min', '-64');
	expect(slider).toHaveAttribute('max', '64');
	expect(slider).toHaveAttribute('step', '2');
	fireEvent.keyDown(slider, { key: 'ArrowRight' });
	// Native range-input change is also used by browser accessibility controls.
	fireEvent.change(slider, { target: { value: '2' } });
	await waitFor(() => expect(restreamer.SetCameraControl).toHaveBeenCalledWith('/dev/video2', 10, 2));
	expect(screen.queryByText('Apply')).not.toBeInTheDocument();
	expect(slider).toHaveValue('2');
});

test('driver errors show an alert and restore the real camera value', async () => {
	const restreamer = { CameraControls: vi.fn().mockResolvedValue([[brightness], null]), SetCameraControl: vi.fn().mockResolvedValue([null, new Error('Camera is busy')]) };
	render(<CameraControls live device="/dev/video0" restreamer={restreamer} />);
	fireEvent.click(screen.getByText('Camera controls'));
	const slider = await screen.findByRole('slider', { name: 'Brightness' });
	fireEvent.change(slider, { target: { value: '2' } });
	expect(await screen.findByRole('alert')).toHaveTextContent('Camera is busy');
	await waitFor(() => expect(slider).toHaveValue('0'));
	expect(restreamer.CameraControls).toHaveBeenCalledTimes(2);
});

test('inactive controls cannot be written', async () => {
	const restreamer = { CameraControls: vi.fn().mockResolvedValue([[{ ...brightness, inactive: true }], null]), SetCameraControl: vi.fn() };
	render(<CameraControls live device="/dev/video0" restreamer={restreamer} />);
	fireEvent.click(screen.getByText('Camera controls'));
	expect(await screen.findByRole('slider', { name: 'Brightness' })).toBeDisabled();
	expect(restreamer.SetCameraControl).not.toHaveBeenCalled();
});

test('an integer driver without an increment uses a one-unit slider step', async () => {
	const control = { ...brightness, step: 0 };
	const restreamer = { CameraControls: vi.fn().mockResolvedValue([[control], null]), SetCameraControl: vi.fn().mockResolvedValue([[{ ...control, value: 1 }], null]) };
	render(<CameraControls live device="/dev/video0" restreamer={restreamer} />);
	fireEvent.click(screen.getByText('Camera controls'));
	const slider = await screen.findByRole('slider', { name: 'Brightness' });
	expect(slider).toHaveAttribute('step', '1');
	fireEvent.change(slider, { target: { value: '1' } });
	await waitFor(() => expect(restreamer.SetCameraControl).toHaveBeenCalledWith('/dev/video0', 10, 1));
});
