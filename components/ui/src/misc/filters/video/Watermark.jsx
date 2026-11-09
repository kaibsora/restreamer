import React from 'react';

import { Trans } from '@lingui/react/macro';
import Backdrop from '@mui/material/Backdrop';
import CircularProgress from '@mui/material/CircularProgress';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import Checkbox from '../../Checkbox';
import Select from '../../Select';
import UploadButton from '../../UploadButton';
import { withDefaults } from '../../../utils/props';

const imageTypes = [
	{ mimetype: 'image/png', extension: 'png', maxSize: 1024 * 1024 },
	{ mimetype: 'image/jpeg', extension: 'jpg', maxSize: 1024 * 1024 },
];

const positionOptions = [
	['top-left', <Trans key="top-left">Top left</Trans>],
	['top-right', <Trans key="top-right">Top right</Trans>],
	['bottom-left', <Trans key="bottom-left">Bottom left</Trans>],
	['bottom-right', <Trans key="bottom-right">Bottom right</Trans>],
	['center', <Trans key="center">Center</Trans>],
];

function init(initialState) {
	const state = {
		enabled: false,
		image: '',
		image_position: 'top-left',
		image_width: '160',
		opacity: '0.85',
		margin: '16',
		text: '',
		text_path: '',
		text_position: 'bottom-left',
		font_size: '24',
		font_color: 'white',
		text_box: true,
		...initialState,
	};
	state.text = typeof state.text === 'string' ? state.text : '';
	state.image = typeof state.image === 'string' ? state.image : '';
	state.text_path =
		typeof state.text_path === 'string' ? state.text_path : '';

	return state;
}

const boundedNumber = (value, minimum, maximum, fallback) => {
	const number = Number(value);
	if (!Number.isFinite(number)) {
		return fallback;
	}

	return Math.min(maximum, Math.max(minimum, number));
};

const isImagePath = (path) =>
	/^\/channels\/[0-9a-z-]+\/watermark\.(?:jpe?g|png)$/i.test(path || '');
const isTextPath = (path) =>
	/^\/channels\/[0-9a-z-]+\/watermark\.txt$/i.test(path || '');

const position = (where, width, height, margin) => {
	switch (where) {
		case 'top-right':
			return [`W-${width}-${margin}`, `${margin}`];
		case 'bottom-left':
			return [`${margin}`, `H-${height}-${margin}`];
		case 'bottom-right':
			return [`W-${width}-${margin}`, `H-${height}-${margin}`];
		case 'center':
			return [`(W-${width})/2`, `(H-${height})/2`];
		case 'top-left':
		default:
			return [`${margin}`, `${margin}`];
	}
};

function createGraph(initialSettings, context = {}) {
	const settings = init(initialSettings);
	if (!settings.enabled) {
		return '';
	}

	const hasImage = isImagePath(settings.image);
	const hasText =
		settings.text.trim().length !== 0 && isTextPath(settings.text_path);
	if (!hasImage && !hasText) {
		return '';
	}

	const margin = Math.round(boundedNumber(settings.margin, 0, 256, 16));
	const filters = [];
	let mainInput = '[in]';

	// FFmpeg's generic NVDEC selector explicitly returns CUDA frames. The
	// branding filters are deliberately software filters so they work before
	// every supported hardware encoder uploads to its own device API.
	if (context.decoder === 'nvdec') {
		filters.push('[in]hwdownload,format=nv12[watermark_main]');
		mainInput = '[watermark_main]';
	}

	let graph = '';
	if (hasImage) {
		const width = Math.round(
			boundedNumber(settings.image_width, 16, 1920, 160),
		);
		const opacity = boundedNumber(settings.opacity, 0, 1, 0.85).toFixed(2);
		const [x, y] = position(settings.image_position, 'w', 'h', margin);
		filters.push(
			`movie=filename='{diskfs}${settings.image}',format=rgba,colorchannelmixer=aa=${opacity},scale=${width}:-1,setpts=PTS-STARTPTS[watermark_image]`,
		);
		graph = `${mainInput}[watermark_image]overlay=x=${x}:y=${y}:eof_action=repeat:repeatlast=1:format=auto`;
	} else if (mainInput !== '[in]') {
		graph = `${mainInput}null`;
	}

	if (hasText) {
		const size = Math.round(boundedNumber(settings.font_size, 8, 200, 24));
		const [x, y] = position(settings.text_position, 'tw', 'th', margin);
		const colors = new Set(['white', 'black', 'yellow', 'red']);
		const color = colors.has(settings.font_color)
			? settings.font_color
			: 'white';
		const text = [
			`drawtext=fontfile=/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf`,
			`textfile='{diskfs}${settings.text_path}'`,
			'reload=0',
			'expansion=none',
			`fontcolor=${color}`,
			`fontsize=${size}`,
			`x=${x}`,
			`y=${y}`,
			`box=${settings.text_box ? 1 : 0}`,
			'boxcolor=black@0.5',
			'boxborderw=6',
		].join(':');
		graph = graph.length === 0 ? `${mainInput}${text}` : `${graph},${text}`;
	}

	filters.push(graph);
	return filters.join(';');
}

function Position(inputProps) {
	const props = withDefaults(inputProps, PositionDefaultProps);
	return (
		<Select
			label={props.label}
			value={props.value}
			onChange={props.onChange}
		>
			{positionOptions.map(([value, label]) => (
				<MenuItem key={value} value={value}>
					{label}
				</MenuItem>
			))}
		</Select>
	);
}

const PositionDefaultProps = {
	label: '',
	value: 'top-left',
	onChange: function () {},
};

function Filter(inputProps) {
	const props = withDefaults(inputProps, FilterDefaultProps);
	const settings = init(props.settings);
	const [$saving, setSaving] = React.useState(false);

	const context = {
		decoder: props.profile?.decoder?.coder || 'default',
	};

	const handleChange = (newSettings, automatic = false) => {
		props.onChange(
			newSettings,
			createGraph(newSettings, context),
			automatic,
		);
	};

	const update = (what) => (event) => {
		handleChange({
			...settings,
			[what]: event.target.value,
		});
	};

	const toggle = (what) => () => {
		handleChange({
			...settings,
			[what]: !settings[what],
		});
	};

	const handleImageUpload = async (data, extension) => {
		try {
			const path = await props.onStore(`watermark.${extension}`, data);
			if (path) {
				handleChange({ ...settings, image: path });
			}
		} finally {
			setSaving(false);
		}
	};

	React.useEffect(() => {
		handleChange(settings, true);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<React.Fragment>
			<Grid item xs={12}>
				<Checkbox
					label={
						<Trans>Burn logo or text into the encoded video</Trans>
					}
					checked={settings.enabled}
					onChange={toggle('enabled')}
				/>
			</Grid>
			{settings.enabled && (
				<React.Fragment>
					<Grid item xs={12}>
						<Typography variant="caption">
							<Trans>
								This changes the encoded frames and therefore
								requires video transcoding. The branding is
								inherited by every publication and relay.
							</Trans>
						</Typography>
					</Grid>
					<Grid item xs={12} md={9}>
						<TextField
							variant="outlined"
							fullWidth
							label={<Trans>Watermark image</Trans>}
							value={settings.image}
							InputProps={{ readOnly: true }}
						/>
					</Grid>
					<Grid item xs={12} md={3}>
						<UploadButton
							label={<Trans>Upload</Trans>}
							acceptTypes={imageTypes}
							onStart={() => setSaving(true)}
							onError={() => setSaving(false)}
							onUpload={handleImageUpload}
						/>
					</Grid>
					{settings.image && (
						<React.Fragment>
							<Grid item xs={12} md={6}>
								<Position
									label={<Trans>Logo position</Trans>}
									value={settings.image_position}
									onChange={update('image_position')}
								/>
							</Grid>
							<Grid item xs={6} md={3}>
								<TextField
									variant="outlined"
									fullWidth
									type="number"
									label={<Trans>Logo width (px)</Trans>}
									value={settings.image_width}
									onChange={update('image_width')}
								/>
							</Grid>
							<Grid item xs={6} md={3}>
								<TextField
									variant="outlined"
									fullWidth
									type="number"
									label={<Trans>Logo opacity</Trans>}
									value={settings.opacity}
									onChange={update('opacity')}
									inputProps={{ min: 0, max: 1, step: 0.05 }}
								/>
							</Grid>
						</React.Fragment>
					)}
					<Grid item xs={12}>
						<TextField
							variant="outlined"
							fullWidth
							label={<Trans>Channel name or custom text</Trans>}
							value={settings.text}
							onChange={update('text')}
							inputProps={{ maxLength: 256 }}
						/>
					</Grid>
					{settings.text && (
						<React.Fragment>
							<Grid item xs={12} md={6}>
								<Position
									label={<Trans>Text position</Trans>}
									value={settings.text_position}
									onChange={update('text_position')}
								/>
							</Grid>
							<Grid item xs={6} md={3}>
								<TextField
									variant="outlined"
									fullWidth
									type="number"
									label={<Trans>Font size (px)</Trans>}
									value={settings.font_size}
									onChange={update('font_size')}
								/>
							</Grid>
							<Grid item xs={6} md={3}>
								<Select
									label={<Trans>Text color</Trans>}
									value={settings.font_color}
									onChange={update('font_color')}
								>
									{['white', 'black', 'yellow', 'red'].map(
										(color) => (
											<MenuItem key={color} value={color}>
												{color}
											</MenuItem>
										),
									)}
								</Select>
							</Grid>
							<Grid item xs={12}>
								<Checkbox
									label={
										<Trans>
											Draw a translucent background behind
											text
										</Trans>
									}
									checked={settings.text_box}
									onChange={toggle('text_box')}
								/>
							</Grid>
						</React.Fragment>
					)}
					<Grid item xs={12} md={4}>
						<TextField
							variant="outlined"
							fullWidth
							type="number"
							label={<Trans>Edge margin (px)</Trans>}
							value={settings.margin}
							onChange={update('margin')}
						/>
					</Grid>
				</React.Fragment>
			)}
			<Backdrop open={$saving}>
				<CircularProgress color="inherit" />
			</Backdrop>
		</React.Fragment>
	);
}

const FilterDefaultProps = {
	settings: {},
	profile: {},
	onStore: async function () {
		return '';
	},
	onChange: function () {},
};

const filter = 'watermark';
const filters = [
	'movie',
	'overlay',
	'scale',
	'format',
	'colorchannelmixer',
	'setpts',
	'drawtext',
];
const name = 'Encoded watermark';
const type = 'video';
const hwaccel = true;

function summarize(initialSettings) {
	const settings = init(initialSettings);
	const parts = [];
	if (isImagePath(settings.image)) {
		parts.push('logo');
	}
	if (settings.text.trim().length !== 0 && isTextPath(settings.text_path)) {
		parts.push('text');
	}
	return `${name} (${parts.join(' + ') || 'not configured'})`;
}

function defaults() {
	const settings = init({});
	return {
		settings,
		graph: createGraph(settings),
	};
}

export {
	name,
	filter,
	filters,
	type,
	hwaccel,
	summarize,
	defaults,
	createGraph,
	init,
	Filter as component,
};
