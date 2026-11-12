import React from 'react';
import { Trans } from '@lingui/react/macro';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import CameraControls from '../../misc/CameraControls';

// Only offer controls for physical video inputs used by this channel's profiles.
// In particular, a network source must not expose controls for an unrelated USB camera.
export function cameraDevices(metadata) {
	const devices = new Set();
	for (const profile of metadata?.profiles || []) {
		const source = metadata.sources?.[profile.video?.source];
		if (!['video4linux2', 'raspicam'].includes(source?.type)) continue;
		for (const input of source.inputs || []) {
			if (typeof input.address === 'string' && input.address.length) devices.add(input.address);
		}
	}
	return [...devices];
}

export default function LiveCameraControls({ metadata, restreamer }) {
	const devices = cameraDevices(metadata);
	if (!devices.length) return null;
	return (
		<Grid item xs={12}>
			{devices.map((device) => (
				<React.Fragment key={device}>
					{devices.length > 1 && <Typography variant="caption">{device}</Typography>}
					<CameraControls device={device} restreamer={restreamer} />
				</React.Fragment>
			))}
			<Typography variant="caption">
				<Trans>Adjust camera controls while streaming. To change capture format, resolution, frame rate or encoding, edit the stream.</Trans>
			</Typography>
		</Grid>
	);
}
