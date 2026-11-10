import React from 'react';

import { faUsb } from '@fortawesome/free-brands-svg-icons';
import { useLingui } from '@lingui/react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { Trans } from '@lingui/react/macro';
import { t } from '@lingui/core/macro';
import makeStyles from '@mui/styles/makeStyles';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import RefreshIcon from '@mui/icons-material/Refresh';
import Typography from '@mui/material/Typography';

import FormInlineButton from '../../../misc/FormInlineButton';
import SelectCustom from '../../../misc/SelectCustom';
import Video from '../../../misc/coders/settings/Video';
import { withDefaults } from '../../../utils/props';

const useStyles = makeStyles((theme) => ({
	gridContainer: {
		marginTop: '0.5em',
	},
}));

const initSettings = (initialSettings) => {
	if (!initialSettings) {
		initialSettings = {};
	}

	const settings = {
		device: 'none',
		format: 'auto',
		framerate: 'auto',
		size: 'auto',
		...initialSettings,
	};

	return settings;
};

const createInputs = (settings) => {
	const address = settings.device === 'custom' || settings.device === 'none' ? settings.deviceCustom : settings.device;
	const input = {
		address: address,
		options: [],
	};

	input.options.push('-f', 'video4linux2');
	if (settings.framerate !== 'auto') input.options.push('-framerate', '' + settings.framerate);
	if (settings.size !== 'auto') input.options.push('-video_size', settings.size);
	if (settings.format !== 'auto') input.options.push('-input_format', settings.format);

	return [input];
};

function Source(inputProps) {
	const props = withDefaults(inputProps, SourceDefaultProps);
	const classes = useStyles();
	const { i18n } = useLingui();
	const settings = initSettings(props.settings);

	const handleChange = (what) => (event) => {
		let data = {};

		if (['device', 'format', 'framerate', 'size'].includes(what)) {
			data[what] = event.target.value;
		}

		props.onChange({
			...settings,
			...data,
		});
	};

	const handleRefresh = () => {
		props.onRefresh();
	};

	const handleProbe = () => {
		props.onProbe(settings, createInputs(settings));
	};

	const filteredDevices = props.knownDevices.filter((device) => device.media === 'video');
	const options = filteredDevices.map((device) => {
		return {
			value: device.id,
			label: device.name + ' (' + device.id + ')',
		};
	});

	options.unshift({
		value: 'none',
		label: i18n._(t`Choose an input device ...`),
		disabled: true,
	});

	options.push({
		value: 'custom',
		label: i18n._(t`Custom ...`),
	});

	return (
		<Grid container alignItems="flex-start" spacing={2} className={classes.gridContainer}>
			<Grid item xs={12}>
				<Typography>
					<Trans>Select a device:</Trans>
				</Typography>
			</Grid>
			<Grid item xs={12}>
				<SelectCustom
					options={options}
					label={<Trans>Video device</Trans>}
					customLabel={<Trans>Custom video device</Trans>}
					value={settings.device}
					onChange={handleChange('device')}
					variant="outlined"
					allowCustom
				/>
				<Button size="small" startIcon={<RefreshIcon />} onClick={handleRefresh} sx={{ float: 'right' }}>
					<Trans>Refresh</Trans>
				</Button>
			</Grid>
			<Grid item xs={12}>
				<Video.Format value={settings.format} onChange={handleChange('format')} allowAuto allowCustom />
			</Grid>
			<Grid item xs={12}>
				<Video.Framerate value={settings.framerate} onChange={handleChange('framerate')} allowAuto allowCustom />
			</Grid>
			<Grid item xs={12}>
				<Video.Size value={settings.size} onChange={handleChange('size')} allowAuto allowCustom />
			</Grid>
			<Grid item xs={12}>
				<FormInlineButton onClick={handleProbe}>
					<Trans>Probe</Trans>
				</FormInlineButton>
			</Grid>
		</Grid>
	);
}

const SourceDefaultProps = {
	knownDevices: [],
	settings: {},
	onChange: function (settings) {},
	onProbe: function (settings, inputs) {},
	onRefresh: function () {},
};

function SourceIcon(props) {
	return <FontAwesomeIcon icon={faUsb} style={{ color: '#FFF' }} {...props} />;
}

const id = 'video4linux2';
const name = <Trans>Hardware device</Trans>;
const capabilities = ['video'];
const ffversion = '>=4.1.0';

const func = {
	initSettings,
	createInputs,
};

export { id, name, capabilities, ffversion, SourceIcon as icon, Source as component, func };
