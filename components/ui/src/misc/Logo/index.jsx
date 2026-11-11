import React from 'react';

import makeStyles from '@mui/styles/makeStyles';

// Modified for CQComber Restreamer: original fork artwork; upstream credit is in About.
import company_logo from './images/cqcomber-mark.svg';
import * as Project from '../../project';

const useStyles = makeStyles((theme) => ({
	Logo: {
		height: 27,
		display: 'inline-flex',
		alignItems: 'center',
		gap: 8,
		color: 'inherit',
		textDecoration: 'none',
		'& img': { height: 27, width: 27 },
	},
}));

export default function Logo(props) {
	const classes = useStyles();

	let link = Project.Repository;

	// eslint-disable-next-line no-useless-escape
	return (
		<a href={link} className={classes.Logo} target="_blank" rel="noopener noreferrer">
			<img src={company_logo} alt="" />
			<span>CQComber</span>
		</a>
	);
}
