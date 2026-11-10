import React from 'react';
import { Trans } from '@lingui/react/macro';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Select from './Select';
import Video from './coders/settings/Video';

export const preferredFormat = (formats) =>
	formats.find((mode) => mode.input_format === 'h264') ||
	formats.find((mode) => mode.input_format === 'mjpeg') ||
	formats.find((mode) => mode.input_format);

export default function CameraCapture(props) {
	return <Capture key={props.device} {...props} />;
}

function Capture({ device, settings, onChange, restreamer, refreshKey = 0 }) {
	const [formats, setFormats] = React.useState(null);
	const [failed, setFailed] = React.useState(false);
	const latest = React.useRef({ settings, onChange });
	latest.current = { settings, onChange };
	React.useEffect(() => {
		let active = true;
		setFormats(null);
		setFailed(false);
		if (!device || !restreamer?.CameraModes)
			return () => {
				active = false;
			};
		Promise.resolve(restreamer.CameraModes(device))
			.then(([values, err]) => {
				if (!active) return;
				setFormats(err ? null : values);
				setFailed(!!err);
				const automatic =
					!err && values?.length
						? preferredFormat(values)?.input_format || ''
						: '';
				if ((latest.current.settings.auto_format || '') !== automatic)
					latest.current.onChange({
						...latest.current.settings,
						auto_format: automatic,
					});
			})
			.catch(() => {
				if (active) setFailed(true);
			});
		return () => {
			active = false;
		};
	}, [device, restreamer, refreshKey]);
	const update = (key) => (event) => {
		const value = event.target.value;
		onChange({
			...settings,
			...(key === 'format' || key === 'size'
				? { framerate: 'auto' }
				: {}),
			...(key === 'format' ? { size: 'auto' } : {}),
			[key]: value,
		});
	};
	if (!formats?.length)
		return (
			<>
				{failed && (
					<Grid item xs={12}>
						<Typography>
							<Trans>
								Camera modes could not be read. Manual capture
								settings remain available.
							</Trans>
						</Typography>
					</Grid>
				)}
				<Grid item xs={12}>
					<Video.Format
						value={settings.format}
						onChange={update('format')}
						allowAuto
						allowCustom
					/>
				</Grid>
				<Grid item xs={12}>
					<Video.Size
						value={settings.size}
						onChange={update('size')}
						allowAuto
						allowCustom
					/>
				</Grid>
				<Grid item xs={12}>
					<Video.Framerate
						value={settings.framerate}
						onChange={update('framerate')}
						allowAuto
						allowCustom
					/>
				</Grid>
			</>
		);
	const format =
		settings.format === 'auto'
			? preferredFormat(formats)
			: formats.find((mode) => mode.input_format === settings.format);
	const sizes = format?.sizes || [];
	const size = sizes.find(
		(mode) => `${mode.width}x${mode.height}` === settings.size,
	);
	const rates = [...new Set(size?.frame_rates || [])];
	const unlistedFormat =
		settings.format !== 'auto' &&
		!formats.some((mode) => mode.input_format === settings.format);
	return (
		<>
			<Grid item xs={12}>
				<Select
					label={<Trans>Format</Trans>}
					value={settings.format}
					onChange={update('format')}
				>
					<MenuItem value="auto">
						<Trans>Automatic</Trans>
					</MenuItem>
					{formats.map((mode) => (
						<MenuItem
							key={mode.fourcc}
							value={mode.input_format || mode.fourcc}
							disabled={!mode.input_format}
						>
							{mode.name} ({mode.fourcc})
						</MenuItem>
					))}
					{unlistedFormat && (
						<MenuItem value={settings.format} disabled>
							{settings.format} —{' '}
							<Trans>Not advertised by this camera</Trans>
						</MenuItem>
					)}
				</Select>
				{settings.format === 'auto' && (
					<Typography variant="caption">
						<Trans>
							Automatic capture prefers camera H.264, then MJPEG,
							when advertised and verified.
						</Trans>
					</Typography>
				)}
			</Grid>
			<Grid item xs={12}>
				{sizes.length ? (
					<Select
						label={<Trans>Size</Trans>}
						value={settings.size}
						onChange={update('size')}
					>
						<MenuItem value="auto">
							<Trans>Automatic</Trans>
						</MenuItem>
						{sizes.map((mode) => (
							<MenuItem
								key={`${mode.width}x${mode.height}`}
								value={`${mode.width}x${mode.height}`}
							>
								{mode.width}×{mode.height}
							</MenuItem>
						))}
						{settings.size !== 'auto' && !size && (
							<MenuItem value={settings.size} disabled>
								{settings.size} —{' '}
								<Trans>Not advertised by this camera</Trans>
							</MenuItem>
						)}
					</Select>
				) : (
					<TextField
						fullWidth
						label={
							<Trans>Capture size (WIDTHxHEIGHT or auto)</Trans>
						}
						value={settings.size}
						onChange={update('size')}
					/>
				)}
				{format?.size_range && (
					<Typography variant="caption">
						<Trans>Driver size range:</Trans>{' '}
						{format.size_range.minimum_width}–
						{format.size_range.maximum_width} ×{' '}
						{format.size_range.minimum_height}–
						{format.size_range.maximum_height};{' '}
						<Trans>width/height steps:</Trans>{' '}
						{format.size_range.step_width}/
						{format.size_range.step_height}
					</Typography>
				)}
			</Grid>
			<Grid item xs={12}>
				{rates.length ? (
					<Select
						label={<Trans>Framerate</Trans>}
						value={settings.framerate}
						onChange={update('framerate')}
					>
						<MenuItem value="auto">
							<Trans>Automatic</Trans>
						</MenuItem>
						{rates.map((rate) => (
							<MenuItem key={rate} value={rate}>
								{rate} FPS
							</MenuItem>
						))}
						{settings.framerate !== 'auto' &&
							!rates.includes(settings.framerate) && (
								<MenuItem value={settings.framerate} disabled>
									{settings.framerate} —{' '}
									<Trans>Not advertised for this mode</Trans>
								</MenuItem>
							)}
					</Select>
				) : (
					<TextField
						fullWidth
						label={<Trans>Capture framerate (FPS or auto)</Trans>}
						value={settings.framerate}
						onChange={update('framerate')}
					/>
				)}
				{settings.size === 'auto' && (
					<Typography variant="caption">
						<Trans>
							Select a capture size to list its advertised frame
							rates.
						</Trans>
					</Typography>
				)}
				{size?.interval_range && (
					<Typography variant="caption">
						<Trans>Driver frame interval range (seconds):</Trans>{' '}
						{size.interval_range.minimum.join('/')}–
						{size.interval_range.maximum.join('/')};{' '}
						<Trans>step:</Trans>{' '}
						{size.interval_range.step.join('/')}
					</Typography>
				)}
			</Grid>
			<Grid item xs={12}>
				<Typography variant="caption">
					<Trans>
						These are capture capabilities, not simultaneous video
						tracks. Verification checks the selected mode. H.264 can
						use stream copy; rotation and other video filters
						require transcoding.
					</Trans>
				</Typography>
			</Grid>
		</>
	);
}
