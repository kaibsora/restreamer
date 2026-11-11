import React from 'react';

import makeStyles from '@mui/styles/makeStyles';

// Modified for CQComber Restreamer: original fork artwork.
import company_logo from './images/cqcomber-mark.svg';
import * as Project from '../../project';

const useStyles = makeStyles((theme) => ({
	Logo: {
		height: 95,
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
