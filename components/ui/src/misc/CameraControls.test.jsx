import React from 'react';
import { render, fireEvent, screen, waitFor } from '../utils/testing';
import CameraControls from './CameraControls';

const brightness = {id:10, name:'Brightness', type:'integer', minimum:0, maximum:255, step:1, value:128, supported:true, choices:[]};

test('loads lazily and applies a control to the selected camera with driver readback', async () => {
	const restreamer = {CameraControls:vi.fn().mockResolvedValue([[brightness],null]), SetCameraControl:vi.fn().mockResolvedValue([[{...brightness,value:129}],null])};
	render(<CameraControls device="/dev/video2" restreamer={restreamer} />);
	expect(restreamer.CameraControls).not.toHaveBeenCalled();
	fireEvent.click(screen.getByText('Camera controls'));
	const field = await screen.findByRole('spinbutton', {name:'Brightness'});
	fireEvent.change(field, {target:{value:'129'}});
	fireEvent.click(screen.getByRole('button',{name:'Brightness'}));
	await waitFor(()=>expect(restreamer.SetCameraControl).toHaveBeenCalledWith('/dev/video2',10,129));
	await waitFor(()=>expect(field).toHaveValue(129));
});

test('inactive controls stay disabled and unsupported controls do not become writable', async () => {
	const restreamer = {CameraControls:vi.fn().mockResolvedValue([[{...brightness,inactive:true}],null])};
	render(<CameraControls device="/dev/video0" restreamer={restreamer} />);
	fireEvent.click(screen.getByText('Camera controls'));
	expect(await screen.findByRole('spinbutton',{name:'Brightness'})).toBeDisabled();
	expect(screen.getByRole('button',{name:'Brightness'})).toBeDisabled();
});

test('switching cameras discards old controls and ignores a delayed response', async () => {
	let resolve;
	const restreamer = {CameraControls:vi.fn().mockReturnValueOnce(new Promise((done)=>{resolve=done;})).mockResolvedValueOnce([[],null])};
	const {rerender}=render(<CameraControls device="/dev/video0" restreamer={restreamer} />);
	fireEvent.click(screen.getByText('Camera controls'));
	rerender(<CameraControls device="/dev/video2" restreamer={restreamer} />);
	fireEvent.click(screen.getByText('Camera controls'));
	await screen.findByText('This camera reports no adjustable controls.');
	resolve([[brightness],null]);
	await waitFor(()=>expect(screen.queryByRole('spinbutton',{name:'Brightness'})).not.toBeInTheDocument());
});
