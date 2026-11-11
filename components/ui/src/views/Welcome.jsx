import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { Trans } from '@lingui/react/macro';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import Typography from '@mui/material/Typography';

// Modified for CQComber Restreamer: independent fork welcome and artwork.
import welcomeImage from '../assets/images/cqcomber-banner.svg';
import * as Project from '../project';
import Paper from '../misc/Paper';
import PaperThumb from '../misc/PaperThumb';

export default function Welcome(props) {
	const navigate = useNavigate();
	const { channelid: _channelid } = useParams();

	return (
		<Paper xs={12} md={6} className="PaperM">
			<Grid container justifyContent="center" spacing={2}>
				<Grid item xs={12}>
					<PaperThumb image={welcomeImage} title={Project.Name} height="200px" />
				</Grid>
				<Grid item xs={12}></Grid>
				<Grid item xs={12}>
					<Typography align="center">
						<Trans>
							Welcome to {Project.Name}, an independent adaptation of datarhei Restreamer for multi-camera video streaming. Further help in the{' '}
							<Link color="secondary" target="_blank" rel="noopener noreferrer" href={Project.Documentation}>
								docs
							</Link>
							.
						</Trans>
					</Typography>
				</Grid>
				<Grid item xs={12}></Grid>
				<Grid item xs={12}>
					<Button fullWidth variant="outlined" color="primary" onClick={() => navigate(`/${_channelid}/edit/wizard`)}>
						<Trans>Next: Video setup</Trans>
					</Button>
				</Grid>
			</Grid>
		</Paper>
	);
}
