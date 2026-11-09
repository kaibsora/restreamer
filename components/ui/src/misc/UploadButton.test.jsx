import { fireEvent, render } from '@testing-library/react';

import UploadButton, { validateUpload } from './UploadButton';

const MiB = 1024 * 1024;

test('accepts files of any size when the type has no limit', () => {
	const file = { size: 30 * MiB, type: 'video/mp4' };
	const result = validateUpload(file, [{ mimetype: 'video/*', extension: 'video', maxSize: 0 }]);

	expect(result).toEqual({
		type: { mimetype: 'video/*', extension: 'video', maxSize: 0 },
	});
});

test('uploads the File directly without copying it into an ArrayBuffer', () => {
	const onUpload = vi.fn();
	const file = new File(['camera data'], 'camera-loop.mp4', { type: 'video/mp4' });
	const { container } = render(
		<UploadButton
			acceptTypes={[{ mimetype: 'video/*', extension: 'video', maxSize: 0 }]}
			onUpload={onUpload}
		/>,
	);

	fireEvent.change(container.querySelector('input[type="file"]'), {
		target: { files: [file] },
	});

	expect(onUpload).toHaveBeenCalledWith(file, 'video', 'video/*');
});

test('retains finite limits for small uploaded assets', () => {
	const file = new File([new Uint8Array(2 * MiB)], 'logo.png', { type: 'image/png' });
	const result = validateUpload(file, [{ mimetype: 'image/png', extension: 'png', maxSize: MiB }]);

	expect(result.error).toEqual({
		type: 'size',
		actual: 2 * MiB,
		allowed: MiB,
	});
});

test('rejects files outside the accepted MIME types', () => {
	const file = new File(['not video'], 'notes.txt', { type: 'text/plain' });
	const result = validateUpload(file, [{ mimetype: 'video/*', extension: 'video', maxSize: 0 }]);

	expect(result.error).toEqual({
		type: 'mimetype',
		actual: 'text/plain',
		allowed: ['video/*'],
	});
});
