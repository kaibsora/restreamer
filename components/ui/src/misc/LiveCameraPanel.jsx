import React from 'react';
import { Trans } from '@lingui/react/macro';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import MenuItem from '@mui/material/MenuItem';
import Slider from '@mui/material/Slider';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { createCameraControlQueue } from '../utils/cameraControlQueue';

export default function LiveCameraPanel({ device, restreamer }) {
	const [open, setOpen] = React.useState(false);
	const [controls, setControls] = React.useState(null);
	const [drafts, setDrafts] = React.useState({});
	const [loading, setLoading] = React.useState(false);
	const [updating, setUpdating] = React.useState(false);
	const [error, setError] = React.useState('');
	const queue = React.useRef(null);
	const sequence = React.useRef(0);
	const expanded = React.useRef(false);

	const readback = (values, pending = {}) => {
		setControls(values);
		setDrafts({ ...Object.fromEntries(values.map((control) => [control.id, control.value ?? ''])), ...pending });
	};
	const refresh = async (clearError = true) => {
		const current = ++sequence.current;
		setLoading(true);
		if (clearError) setError('');
		try {
			const [values, err] = await restreamer.CameraControls(device);
			if (current !== sequence.current) return;
			if (err) throw err;
			queue.current?.update(values);
			readback(values);
		} catch (err) {
			if (current === sequence.current && clearError) setError(err.message);
		} finally {
			if (current === sequence.current) setLoading(false);
		}
	};

	React.useEffect(() => {
		const writer = createCameraControlQueue({
			write: (id, value) => restreamer.SetCameraControl(device, id, value),
			onReadback: readback,
			onBusy: setUpdating,
			onError: async (err) => { setError(err.message); await refresh(false); },
		});
		queue.current = writer;
		if (expanded.current) void refresh();
		return () => { sequence.current++; writer.dispose(); queue.current = null; };
		// Device changes remount the panel; a replacement API client resets its writer.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [device, restreamer]);

	const change = (control, value, commit = false) => {
		setDrafts((previous) => ({ ...previous, [control.id]: value }));
		setError('');
		queue.current?.change(control.id, Number(value), commit);
	};

	return (
		<Accordion expanded={open} onChange={(_, value) => { expanded.current = value; setOpen(value); if (value && controls === null && !loading) void refresh(); }}>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography><Trans>Camera controls</Trans></Typography></AccordionSummary>
			<AccordionDetails>
				<Typography paragraph><Trans>Changes apply immediately to this physical camera, including other streams using it. The camera may reset them after unplugging or restarting.</Trans></Typography>
				<Button onClick={() => refresh()} disabled={loading || updating}><Trans>Refresh controls</Trans></Button>
				{error && <Alert severity="error">{error}</Alert>}
				<Typography role="status" sx={{ minHeight: '1.5em' }}>
					{loading ? <Trans>Reading camera controls...</Trans> : updating ? <Trans>Updating camera controls...</Trans> : '\u00a0'}
				</Typography>
				{controls?.length === 0 && <Typography><Trans>This camera reports no adjustable controls.</Trans></Typography>}
				<Grid container spacing={2}>
					{controls?.map((control) => {
						const unavailable = control.read_only || control.inactive || !control.supported;
						const value = drafts[control.id] ?? '';
						const step = control.step || 1;
						const slider = control.type === 'integer' && [control.minimum, control.maximum, step].every(Number.isSafeInteger) && control.maximum > control.minimum && step > 0;
						const menu = ['boolean', 'menu', 'integer_menu'].includes(control.type);
						const choices = control.type === 'boolean' ? [{ value: 0, name: <Trans>Disabled</Trans> }, { value: 1, name: <Trans>Enabled</Trans> }] : control.choices;
						return (
							<Grid item xs={12} key={control.id}>
								{slider ? <>
									<Typography>{control.name}: {value}</Typography>
									<Slider aria-label={control.name} min={control.minimum} max={control.maximum} step={step} value={Math.min(control.maximum, Math.max(control.minimum, Number(value) || 0))} disabled={loading || unavailable} valueLabelDisplay="auto"
										onChange={(_, next) => change(control, next)} onChangeCommitted={(_, next) => change(control, next, true)} />
								</> : control.type === 'button' ? <Button disabled={loading || updating || unavailable} onClick={() => change(control, 0, true)}>{control.name}: <Trans>Run</Trans></Button> : <>
									<TextField fullWidth label={control.name} select={menu} type={menu ? undefined : 'number'} value={value} disabled={loading || unavailable}
										onChange={(event) => menu ? change(control, event.target.value, true) : setDrafts((previous) => ({ ...previous, [control.id]: event.target.value }))}
										inputProps={{ min: control.minimum, max: control.maximum, step: control.step || 1 }}>
										{menu ? choices.map((choice) => <MenuItem key={choice.value} value={choice.value}>{choice.name}</MenuItem>) : null}
									</TextField>
									{!menu && <Button aria-label={control.name} disabled={loading || updating || unavailable || value === '' || !Number.isSafeInteger(Number(value))} onClick={() => change(control, value, true)}><Trans>Apply</Trans></Button>}
								</>}
								{unavailable && <Typography variant="caption"><Trans>Read-only, unavailable in the current camera mode, or unsupported control type.</Trans></Typography>}
							</Grid>
						);
					})}
				</Grid>
			</AccordionDetails>
		</Accordion>
	);
}
