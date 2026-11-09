import React from 'react';

import FormInlineButton from './FormInlineButton';
import { withDefaults } from '../utils/props';

function validateUpload(file, acceptTypes) {
	if (!file) {
		return {
			error: {
				type: 'nofiles',
			},
		};
	}

	const accept = acceptTypes.map((t) => t.mimetype);
	let type = null;

	for (const candidate of acceptTypes) {
		const allowed = candidate.mimetype.split('/');
		const actual = file.type.split('/');

		if (allowed[0] !== actual[0]) {
			continue;
		}

		if (allowed[1] === '*' || allowed[1] === actual[1]) {
			type = candidate;
			break;
		}
	}

	if (type === null) {
		return {
			error: {
				type: 'mimetype',
				actual: file.type,
				allowed: accept,
			},
		};
	}

	if (type.maxSize > 0 && file.size > type.maxSize) {
		return {
			error: {
				type: 'size',
				actual: file.size,
				allowed: type.maxSize,
			},
		};
	}

	return { type };
}

export default function UploadButton(inputProps) {
	const props = withDefaults(inputProps, UploadButtonDefaultProps);
	const { acceptTypes, label, onError, onStart, onUpload, ...other } = props;

	const accept = props.acceptTypes.map((t) => t.mimetype);

	const handleUpload = (event) => {
		const handler = (event) => {
			const files = event.target.files;
			const file = files.length === 0 ? null : files[0];
			const result = validateUpload(file, props.acceptTypes);

			if (result.error) {
				props.onError(result.error);
				return;
			}

			props.onUpload(file, result.type.extension, result.type.mimetype);
		};

		props.onStart();

		handler(event);

		// reset the value such that the onChange event will be triggered again
		// if the same file gets selected again
		event.target.value = null;
	};

	return (
		<FormInlineButton component="label" {...other}>
			{props.label}
			<input accept={accept.join(',')} type="file" hidden onChange={handleUpload} />
		</FormInlineButton>
	);
}

const UploadButtonDefaultProps = {
	label: '',
	acceptTypes: [],
	onError: function () {},
	onStart: function () {},
	onUpload: function (data, extension) {},
};

export { validateUpload };
