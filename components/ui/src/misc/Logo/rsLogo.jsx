import React from 'react';

import makeStyles from '@mui/styles/makeStyles';

// Modified for CQComber Restreamer: original fork artwork.
import company_logo from './images/cqcomber-mark.svg';
import * as Project from '../../project';

const useStyles = makeStyles((theme) => ({
	Logo: {
		display: 'inline-flex',
		height: 95,
		width: 95,
		flexShrink: 0,
		'& img': { display: 'block', width: '100%', height: '100%' },
	},
}));

export default function Logo(props) {
	const classes = useStyles();

	return (
		<a href={Project.Repository} className={classes.Logo} target="_blank" rel="noopener noreferrer">
			<img src={company_logo} alt={`${Project.Name} logo`} />
		</a>
	);
}
