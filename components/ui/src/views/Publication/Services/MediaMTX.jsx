import React from 'react';

import { faNetworkWired } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans } from '@lingui/react/macro';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Select from '../../../misc/Select';
import { withDefaults } from '../../../utils/props';

const id = 'mediamtx';
const name = 'MediaMTX LAN relay';
const version = '1.0';
const stream_key_link = '';
const description = (
	<Trans>
		Publish a low-latency H.264 stream to the bundled MediaMTX service for
		LAN RTSP and WebRTC clients. See the{' '}
		<Link
			color="secondary"
			target="_blank"
			href="https://github.com/kaibsora/restreamer/blob/main/deploy/README.md#lan-rtsp-and-webrtc"
		>
			deployment guide
		</Link>
		.
	</Trans>
);
const image_copyright = '';
const author = {
	creator: {
		name: 'kaibsora',
		link: 'https://github.com/kaibsora',
	},
	maintainer: {
		name: 'kaibsora',
		link: 'https://github.com/kaibsora',
	},
};
const category = 'software';
const requires = {
	protocols: ['rtp'],
	formats: ['rtsp'],
	codecs: {
		audio: ['aac', 'opus'],
		video: ['h264'],
	},
};

function ServiceIcon(props) {
	return (
		<FontAwesomeIcon
			icon={faNetworkWired}
			style={{ color: '#188A42' }}
			{...props}
		/>
	);
}

function slugifyPath(value) {
	const path = String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '');

	return path || 'camera';
}

function defaultClientHost() {
	if (
		typeof window !== 'undefined' &&
		typeof window.location?.hostname === 'string' &&
		window.location.hostname.length !== 0
	) {
		return window.location.hostname;
	}

	return 'RESTREAMER_LAN_IP';
}

function normalizeClientHost(value) {
	let host = String(value || '')
		.trim()
		.replace(/^[a-z][a-z0-9+.-]*:\/\//i, '')
		.split('/')[0];

	const bracketedIPv6 = host.match(/^\[([^\]]+)\](?::[0-9]+)?$/);
	if (bracketedIPv6 !== null) {
		return `[${bracketedIPv6[1]}]`;
	}

	if ((host.match(/:/g) || []).length > 1) {
		return `[${host}]`;
	}

	return host.replace(/:[0-9]+$/, '');
}

function createClientUrls(inputSettings) {
	const settings = init(inputSettings);
	const host = normalizeClientHost(settings.client_host);
	const path = String(settings.path || '')
		.trim()
		.replace(/^\/+|\/+$/g, '');

	if (host.length === 0 || path.length === 0) {
		return { rtsp: '', webrtc: '' };
	}

	return {
		rtsp: `rtsp://${host}:8554/${path}`,
		webrtc: `http://${host}:8889/${path}`,
	};
}

function init(settings, metadata = {}, pathPrefix = '', explicitDefaultPath = '') {
	const prefix = String(pathPrefix || '')
		.trim()
		.replace(/^\/+|\/+$/g, '');
	const channelPath = slugifyPath(metadata.name);
	const generatedPath =
		prefix.length === 0 ? channelPath : `${prefix}/${channelPath}`;
	const defaultPath = explicitDefaultPath || generatedPath;

	return {
		server: 'rtsp://mediamtx:8554',
		path: defaultPath,
		transport: 'tcp',
		client_host: defaultClientHost(),
		...settings,
	};
}

function createOutput(inputSettings) {
	const settings = init(inputSettings);
	let server = String(settings.server || '')
		.trim()
		.replace(/\/+$/, '');
	const path = String(settings.path || '')
		.trim()
		.replace(/^\/+|\/+$/g, '');
	const transport = settings.transport === 'udp' ? 'udp' : 'tcp';

	if (server.length !== 0 && !/^[a-z][a-z0-9+.-]*:\/\//i.test(server)) {
		server = `rtsp://${server}`;
	}

	return {
		address:
			server.length === 0 || path.length === 0 ? '' : `${server}/${path}`,
		options: [
			'-f',
			'rtsp',
			'-rtsp_transport',
			transport,
			'-muxdelay',
			'0',
			'-pkt_size',
			'1200',
		],
	};
}

function Service(inputProps) {
	const props = withDefaults(inputProps, ServiceDefaultProps);
	const settings = init(
		props.settings,
		props.metadata,
		props.pathPrefix,
		props.defaultPath,
	);

	React.useEffect(() => {
		props.onChange([createOutput(settings)], settings);
		// Initialize the publication once; subsequent changes are emitted below.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handleChange = (what) => (event) => {
		settings[what] = event.target.value;
		props.onChange([createOutput(settings)], settings);
	};

	const output = createOutput(settings);
	const clientUrls = createClientUrls(settings);

	return (
		<Grid container spacing={2}>
			<Grid item xs={12} md={8}>
				<TextField
					variant="outlined"
					fullWidth
					type="url"
					label={<Trans>Internal MediaMTX server</Trans>}
					value={settings.server}
					onChange={handleChange('server')}
				/>
			</Grid>
			<Grid item xs={12} md={4}>
				{props.pathOptions.length === 0 ? (
					<TextField
						variant="outlined"
						fullWidth
						label={<Trans>Stream path</Trans>}
						value={settings.path}
						onChange={handleChange('path')}
					/>
				) : (
					<Select
						label={<Trans>Stream slot</Trans>}
						value={settings.path}
						onChange={handleChange('path')}
					>
						{props.pathOptions.map((path) => (
							<MenuItem key={path} value={path}>
								{path}
							</MenuItem>
						))}
					</Select>
				)}
			</Grid>
			<Grid item xs={12}>
				<Select
					label={<Trans>Publisher transport</Trans>}
					value={settings.transport}
					onChange={handleChange('transport')}
				>
					<MenuItem value="tcp">TCP (recommended)</MenuItem>
					<MenuItem value="udp">UDP</MenuItem>
				</Select>
			</Grid>
			<Grid item xs={12}>
				<TextField
					variant="outlined"
					fullWidth
					label={<Trans>LAN hostname or IP</Trans>}
					value={settings.client_host}
					onChange={handleChange('client_host')}
					helperText={
						<Trans>
							Address used by printer dashboards and other LAN
							clients.
						</Trans>
					}
				/>
			</Grid>
			<Grid item xs={12}>
				<Typography color="textSecondary">
					<Trans>Internal destination:</Trans> {output.address || '—'}
				</Typography>
				<Typography color="textSecondary">
					<Trans>LAN clients:</Trans>{' '}
					{clientUrls.rtsp.length === 0 ? (
						'—'
					) : (
						<>
							<Link href={clientUrls.rtsp}>
								{clientUrls.rtsp}
							</Link>{' '}
							·{' '}
							<Link
								href={clientUrls.webrtc}
								target="_blank"
								rel="noreferrer"
							>
								{clientUrls.webrtc}
							</Link>
						</>
					)}
				</Typography>
			</Grid>
		</Grid>
	);
}

const ServiceDefaultProps = {
	settings: {},
	skills: {},
	metadata: {},
	pathPrefix: '',
	defaultPath: '',
	pathOptions: [],
	streams: [],
	onChange: function (output, settings) {},
};

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
	slugifyPath,
	normalizeClientHost,
	init,
	createOutput,
	createClientUrls,
	ServiceIcon as icon,
	Service as component,
};
