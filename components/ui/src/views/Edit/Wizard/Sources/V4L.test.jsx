import React from 'react';
import { render, fireEvent, screen } from '../../../../utils/testing';
import * as V4L from './V4L';

const cameras = [{ id: '/dev/video0', name: 'USB camera', media: 'video' }];

test('wizard selects a camera without imposing NV12, 720p or 25 FPS', () => {
	const onChange = vi.fn();
	render(<V4L.component knownDevices={cameras} onChange={onChange} />);
	expect(onChange).toHaveBeenLastCalledWith(
		'video4linux2',
		expect.objectContaining({
			device: '/dev/video0',
			format: 'auto',
			size: 'auto',
			framerate: 'auto',
		}),
		[{ address: '/dev/video0', options: ['-f', 'video4linux2'] }],
		true,
	);
});

test('wizard exposes capture settings and retains a chosen MJPEG mode on rerender', () => {
	const onChange = vi.fn();
	const { rerender } = render(
		<V4L.component knownDevices={cameras} onChange={onChange} />,
	);
	fireEvent.mouseDown(screen.getAllByRole('combobox')[1]);
	fireEvent.click(screen.getByRole('option', { name: 'MJPEG' }));
	const settings = onChange.mock.lastCall[1];
	expect(settings.format).toBe('mjpeg');
	expect(onChange.mock.lastCall[2][0].options).toContain('mjpeg');
	rerender(
		<V4L.component
			knownDevices={cameras}
			settings={settings}
			onChange={onChange}
		/>,
	);
	expect(screen.getAllByRole('combobox')[1]).toHaveTextContent('MJPEG');
});
