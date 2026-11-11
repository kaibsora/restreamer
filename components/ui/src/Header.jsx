import React from 'react';

import { styled } from '@mui/material/styles';
import { Trans } from '@lingui/react/macro';
import makeStyles from '@mui/styles/makeStyles';
import BugReportIcon from '@mui/icons-material/BugReport';
import Divider from '@mui/material/Divider';
import Fab from '@mui/material/Fab';
import Grid from '@mui/material/Grid';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import LayersIcon from '@mui/icons-material/Layers';
import Link from '@mui/material/Link';
import ListItemIcon from '@mui/material/ListItemIcon';
import Logout from '@mui/icons-material/Logout';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MenuOpenIcon from '@mui/icons-material/MenuOpen';
import Modal from '@mui/material/Modal';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import Settings from '@mui/icons-material/Settings';
import Stack from '@mui/material/Stack';
import TranslateIcon from '@mui/icons-material/Translate';
import Typography from '@mui/material/Typography';
import VideocamIcon from '@mui/icons-material/Videocam';
import WebIcon from '@mui/icons-material/Web';

import * as Storage from './utils/storage';
import * as Version from './version';
import * as Project from './project';
// Modified for CQComber Restreamer: product branding and retained upstream attribution.
import welcomeImage from './assets/images/cqcomber-banner.svg';
import LanguageSelect from './misc/LanguageSelect';
import Logo from './misc/Logo/rsLogo';
import ModalContent from './misc/ModalContent';
import PaperThumb from './misc/PaperThumb';
import { withDefaults } from './utils/props';

const useStyles = makeStyles((theme) => ({
	header: {
		width: '100%',
		height: 132,
		lineHeight: '132px',
		backgroundColor: 'transparent',
		color: theme.palette.text.secondary,
		'& .headerRight': {
			float: 'right',
			marginRight: 42,
		},
		'& .headerFab': {
			height: 60,
			width: 60,
			marginLeft: '1em',
			boxShadow: 'unset',
			'& .fabIcon': {
				fontSize: 30,
			},
			'&:hover': {
				backgroundColor: theme.palette.background.box_default,
			},
		},
		'& .headerLeft': {
			fontSize: '3.5rem',
			fontWeight: 300,
			marginLeft: 40,
		},
		'& .headerTitle': {
			fontFamily: '"Dosis", "Roboto", "Helvetica", "Arial", sans-serif',
			fontSize: 'clamp(1.2rem, 3.6vw, 3rem)',
			fontWeight: 300,
			marginLeft: 10,
			marginBottom: '0.2em',
		},
		'@media (max-width: 599px)': {
			'& .headerRight': {
				marginRight: 20,
			},
			'& .headerLeft': {
				marginLeft: 20,
			},
			'& .headerTitle': {
				fontSize: 'clamp(1.2rem, 4vw, 2.4rem)',
			},
		},
		'@media (max-width: 415px)': {
			'& .headerRight': {
				marginRight: 20,
			},
			'& .headerLeft': {
				marginLeft: 20,
			},
			'& .headerTitle': {
				display: 'none',
			},
		},
	},
	modalPaper: {
		padding: '1em 1.5em 1.3em 1.5em',
		width: '95%',
		maxWidth: 350,
		maxHeight: '95%',
		overflow: 'scroll',
		backgroundColor: theme.palette.background.modal,
		color: theme.palette.text.primary,
	},
	aboutImage: {
		paddingLeft: '1em',
	},
}));

const StyledMenu = styled((props) => (
	<Menu
		elevation={0}
		anchorOrigin={{
			vertical: 'bottom',
			horizontal: 'right',
		}}
		transformOrigin={{
			vertical: 'top',
			horizontal: 'right',
		}}
		{...props}
	/>
))(({ theme }) => ({
	'& .MuiPaper-root': {
		borderRadius: 5,
		marginTop: theme.spacing(1),
		minWidth: 180,
		boxShadow:
			'rgb(255, 255, 255) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 0px 0px 1px, rgba(0, 0, 0, 0.1) 0px 10px 15px -3px, rgba(0, 0, 0, 0.05) 0px 4px 6px -2px',
		'& .MuiMenu-list': {
			padding: '4px 0',
			backgroundColor: theme.palette.background.paper,
		},
		'& .MuiMenuItem-root': {
			'& .MuiSvgIcon-root': {
				fontSize: 18,
				color: theme.palette.common.white,
				marginRight: theme.spacing(1.5),
			},
			'&:active': {
				backgroundColor: theme.palette.background.box_default,
			},
			'&:hover': {
				backgroundColor: theme.palette.background.box_default,
			},
		},
	},
}));

function AboutModal(inputProps) {
	const props = withDefaults(inputProps, AboutModalDefaultProps);
	const classes = useStyles();

	return (
		<Modal open={props.open} onClose={props.onClose} className="modal">
			<ModalContent title={`About ${Project.Name}`} onClose={props.onClose} className={classes.modalPaper}>
				<Grid container spacing={1}>
					<Grid item xs={12} className={classes.aboutImage}>
						<PaperThumb image={welcomeImage} title={Project.Name} height="200px" />
					</Grid>
					<Grid item xs={12}>
						<Typography variant="body1">
							{Project.Name} is maintained by CQComber (kaibsora on GitHub). This independent adaptation packages the UI, Core, and FFmpeg build into one repository. It is based on the original{' '}
							<Link color="secondary" href={Project.UpstreamRepository} target="_blank" rel="noopener noreferrer">
								datarhei Restreamer
							</Link>{' '}
							and{' '}
							<Link color="secondary" href={Project.UpstreamCore} target="_blank" rel="noopener noreferrer">
								datarhei Core
							</Link>
							.
						</Typography>
					</Grid>
					<Grid item xs={12}></Grid>
					<Grid item xs={12}>
						<Typography>
							<strong>Release</strong>: {Project.Release} (UI {Version.Version})
						</Typography>
						<Typography>
							<strong>Maintained repo</strong>:{' '}
							<Link color="secondary" target="_blank" rel="noopener noreferrer" href={Project.Repository}>
								github.com/kaibsora/restreamer
							</Link>
						</Typography>
						<Typography>
							<strong>Bundled Core</strong>:{' '}
							<Link color="secondary" target="_blank" rel="noopener noreferrer" href={Project.Core}>
								components/core
							</Link>
						</Typography>
						<Typography>
							<strong>Licence</strong>:{' '}
							<Link color="secondary" target="_blank" rel="noopener noreferrer" href={Project.License}>
								Apache License 2.0
							</Link>
						</Typography>
						<Typography>
							<strong>Upstream repo</strong>:{' '}
							<Link color="secondary" target="_blank" rel="noopener noreferrer" href={Project.UpstreamRepository}>
								github.com/datarhei/restreamer
							</Link>
						</Typography>
						<Typography>
							<strong>Original creator</strong>:{' '}
							<Link color="secondary" target="_blank" rel="noopener noreferrer" href={Project.UpstreamWebsite}>
								datarhei.com
							</Link>
						</Typography>
						<Typography>Original Restreamer copyright 2022 FOSS GmbH and contributors. No upstream endorsement is implied.</Typography>
						<Typography>
							<Link color="secondary" href={Project.Credits} target="_blank" rel="noopener noreferrer">Component licenses and source credits</Link>
						</Typography>
					</Grid>
				</Grid>
			</ModalContent>
		</Modal>
	);
}

const AboutModalDefaultProps = {
	open: false,
	onClose: () => {},
};

function HeaderMenu(inputProps) {
	const props = withDefaults(inputProps, HeaderMenuDefaultProps);
	const classes = useStyles();

	const [$anchorEl, setAnchorEl] = React.useState(null);
	const [$about, setAbout] = React.useState(false);

	const handleMenuOpen = (event) => {
		setAnchorEl(event.currentTarget);
	};

	const handleMenuClose = () => {
		setAnchorEl(null);
	};

	const handleLanguageChange = (language) => {
		Storage.Set('language', language);
	};

	if (props.expand === true) {
		return (
			<React.Fragment>
				<Fab className="headerFab" color="primary" onClick={props.onChannel}>
					<VideocamIcon className="fabIcon" />
				</Fab>
				<Fab className="headerFab" color="primary" onClick={handleMenuOpen}>
					<MenuOpenIcon className="fabIcon" />
				</Fab>
				<StyledMenu anchorEl={$anchorEl} open={$anchorEl !== null} onClose={handleMenuClose} onClick={handleMenuClose} disableScrollLock>
					{props.hasService === true && (
						<React.Fragment>
							<MenuItem component="a" href="https://service.datarhei.com" target="_blank" rel="noopener noreferrer">
								<ListItemIcon>
									<LayersIcon fontSize="small" />
								</ListItemIcon>
								<Trans>Service</Trans>
							</MenuItem>
							<Divider />
						</React.Fragment>
					)}
					{props.showPlayersite === true && (
						<MenuItem onClick={props.onPlayersite}>
							<ListItemIcon size="large">
								<WebIcon fontSize="small" size="large" />
							</ListItemIcon>
							<Trans>Playersite</Trans>
						</MenuItem>
					)}
					{props.showSettings === true && (
						<MenuItem onClick={props.onSettings}>
							<ListItemIcon>
								<Settings fontSize="small" />
							</ListItemIcon>
							<Trans>System</Trans>
						</MenuItem>
					)}
					<Divider />
					<MenuItem onClick={() => setAbout(true)}>
						<ListItemIcon>
							<RocketLaunchIcon fontSize="small" />
						</ListItemIcon>
						<Trans>About</Trans>
					</MenuItem>
					<MenuItem component="a" href={Project.Documentation} target="_blank" rel="noopener noreferrer">
						<ListItemIcon>
							<HelpOutlineIcon fontSize="small" />
						</ListItemIcon>
						<Trans>Docs</Trans>
					</MenuItem>
					<MenuItem component="a" href={Project.Issues} target="_blank" rel="noopener noreferrer">
						<ListItemIcon>
							<BugReportIcon fontSize="small" />
						</ListItemIcon>
						<Trans>Issue alert</Trans>
					</MenuItem>
					<MenuItem>
						<ListItemIcon>
							<TranslateIcon fontSize="small" />
						</ListItemIcon>
						<LanguageSelect onChange={handleLanguageChange} />
					</MenuItem>
					<MenuItem onClick={props.onLogout}>
						<ListItemIcon>
							<Logout fontSize="small" />
						</ListItemIcon>
						<Trans>Logout</Trans>
					</MenuItem>
				</StyledMenu>
				<AboutModal open={$about} onClose={() => setAbout(false)} />
			</React.Fragment>
		);
	} else {
		return (
			<React.Fragment>
				<Fab className="headerFab" color="primary" onClick={handleMenuOpen}>
					<MenuOpenIcon className="fabIcon" />
				</Fab>
				<StyledMenu anchorEl={$anchorEl} open={$anchorEl !== null} onClose={handleMenuClose} onClick={handleMenuClose}>
					<MenuItem onClick={() => setAbout(true)}>
						<ListItemIcon>
							<RocketLaunchIcon fontSize="small" />
						</ListItemIcon>
						<Trans>About</Trans>
					</MenuItem>
					<MenuItem component="a" href={Project.Documentation} target="_blank" rel="noopener noreferrer">
						<ListItemIcon>
							<HelpOutlineIcon fontSize="small" />
						</ListItemIcon>
						<Trans>Docs</Trans>
					</MenuItem>
					<MenuItem component="a" href={Project.Issues} target="_blank" rel="noopener noreferrer">
						<ListItemIcon>
							<BugReportIcon fontSize="small" />
						</ListItemIcon>
						<Trans>Issue alert</Trans>
					</MenuItem>
					<MenuItem>
						<ListItemIcon>
							<TranslateIcon fontSize="small" />
						</ListItemIcon>
						<LanguageSelect onChange={handleLanguageChange} />
					</MenuItem>
				</StyledMenu>
				<AboutModal open={$about} onClose={() => setAbout(false)} />
			</React.Fragment>
		);
	}
}

const HeaderMenuDefaultProps = {
	onChannel: () => {},
	onPlayersite: () => {},
	onSettings: () => {},
	onLogout: () => {},
	expand: false,
	showPlayersite: false,
	showSettings: false,
	hasService: false,
};

export default function Header(inputProps) {
	const props = withDefaults(inputProps, HeaderDefaultProps);
	const classes = useStyles();

	return (
		<Grid container className={classes.header} spacing={0} direction="row" alignItems="center">
			<Grid item xs={12}>
				<Stack direction="row" justifyContent="space-between" alignItems="center" spacing={0}>
					<Stack direction="row" alignItems="center" spacing={0} className="headerLeft">
						<Logo className="fabIcon" />
						<Typography className="headerTitle">{Project.Name}</Typography>
					</Stack>
					<Stack className="headerRight" direction="row" alignItems="center" spacing={0}>
						<HeaderMenu {...props}></HeaderMenu>
					</Stack>
				</Stack>
			</Grid>
		</Grid>
	);
}

const HeaderDefaultProps = {
	expand: false,
};
