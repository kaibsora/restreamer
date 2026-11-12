import React from 'react';

import { Trans } from '@lingui/react/macro';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

import * as MediaMTX from './MediaMTX';

const id = 'mediamtxresilient';
const name = 'MediaMTX resilient LAN relay';
const version = '1.0';
const stream_key_link = '';
const description = (
	<Trans>
		Keep an H.264 LAN stream available with an offline slate while its camera
		or Restreamer process is unavailable. See the{' '}
		<Link
			color="secondary"
			target="_blank"
			href="https://github.com/kaibsora/restreamer/blob/main/deploy/README.md#keep-a-dashboard-stream-available-while-its-camera-is-offline"
		>
			deployment guide
		</Link>
		.
	</Trans>
);
const image_copyright = '';
const author = MediaMTX.author;
const category = 'software';
const icon = MediaMTX.icon;
const pathOptions = Array.from(
	{ length: 16 },
	(_, index) => `resilient/${String(index + 1).padStart(2, '0')}`,
);
const requires = {
	protocols: ['rtp'],
	formats: ['rtsp'],
	codecs: {
		audio: ['none'],
		video: ['h264'],
	},
	copy: {
		audio: false,
		video: true,
	},
};

function init(settings, metadata = {}) {
	return MediaMTX.init(settings, metadata, '', pathOptions[0]);
}

function Service(props) {
	return (
		<>
			<Typography color="warning.main" sx={{ mb: 2 }}>
				<Trans>
					This resilient path is video-only. Audio is intentionally removed so
					MediaMTX can replace the publisher with its built-in H.264 offline
					slate without changing the stream track layout.
				</Trans>
			</Typography>
			<MediaMTX.component
				{...props}
				defaultPath={pathOptions[0]}
				pathOptions={pathOptions}
			/>
		</>
	);
}

export {
	id,
	name,
	version,
	stream_key_link,
	description,
	image_copyright,
	author,
	category,
	requires,
	pathOptions,
	init,
	MediaMTX as base,
	icon,
	Service as component,
};
