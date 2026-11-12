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
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import LiveCameraPanel from './LiveCameraPanel';

// A device change remounts this panel so delayed reads cannot populate another
// camera's controls. No polling, subprocesses, or streaming workload is needed.
export default function CameraControls({ device, restreamer, live = false }) {
	if (!device || !restreamer || !restreamer.CameraControls) return null;
	if (live) return <LiveCameraPanel key={device} device={device} restreamer={restreamer} />;
	return <Panel key={device} device={device} restreamer={restreamer} />;
}

function Panel({ device, restreamer }) {
	const [open, setOpen] = React.useState(false);
	const [controls, setControls] = React.useState(null);
	const [drafts, setDrafts] = React.useState({});
	const [busy, setBusy] = React.useState(false);
	const [error, setError] = React.useState('');
	const sequence = React.useRef(0);
	React.useEffect(() => () => { sequence.current++; }, []);

	const request = async (operation) => {
		const current = ++sequence.current;
		setBusy(true);
		setError('');
		try {
			const [values, err] = await operation();
			if (current !== sequence.current) return;
			if (err) { setError(err.message); return; }
			setControls(values);
			setDrafts(Object.fromEntries(values.map((control) => [control.id, control.value ?? ''])));
		} catch (err) {
			if (current === sequence.current) setError(err.message);
		} finally {
			if (current === sequence.current) setBusy(false);
		}
	};
	const refresh = () => request(() => restreamer.CameraControls(device));
	const apply = (control) => request(() => restreamer.SetCameraControl(device, control.id, control.type === 'button' ? 0 : Number(drafts[control.id])));

	return (
		<Accordion expanded={open} onChange={(_, expanded) => { setOpen(expanded); if (expanded && controls === null && !busy) refresh(); }}>
			<AccordionSummary expandIcon={<ExpandMoreIcon />}><Typography><Trans>Camera controls</Trans></Typography></AccordionSummary>
			<AccordionDetails>
				<Typography paragraph><Trans>Changes apply immediately to this physical camera, including other streams using it. The camera may reset them after unplugging or restarting.</Trans></Typography>
				<Button onClick={refresh} disabled={busy}><Trans>Refresh controls</Trans></Button>
				{error && <Alert severity="error">{error}</Alert>}
				{busy && <Typography role="status"><Trans>Reading camera controls...</Trans></Typography>}
				{controls?.length === 0 && <Typography><Trans>This camera reports no adjustable controls.</Trans></Typography>}
				<Grid container spacing={2}>
					{controls?.map((control) => {
						const unavailable = control.read_only || control.inactive || !control.supported;
						const value = drafts[control.id] ?? '';
						const valid = control.type === 'button' || (value !== '' && Number.isSafeInteger(Number(value)));
						const choices = control.type === 'boolean' ? [{value:0, name:<Trans>Disabled</Trans>}, {value:1, name:<Trans>Enabled</Trans>}] : control.choices;
						const menu = ['boolean', 'menu', 'integer_menu'].includes(control.type);
						return (
							<Grid item xs={12} key={control.id}>
								<Grid container spacing={1} alignItems="center">
									<Grid item xs>
										{control.type === 'button' ? <Typography>{control.name}</Typography> : <TextField fullWidth label={control.name} select={menu} type={menu ? undefined : 'number'} value={value} disabled={busy || unavailable}
											onChange={(event) => setDrafts({...drafts, [control.id]:event.target.value})}
											inputProps={{min:control.minimum, max:control.maximum, step:control.step || 1}}
											helperText={unavailable ? <Trans>Read-only, unavailable in the current camera mode, or unsupported control type.</Trans> : undefined}>
											{menu ? choices.map((choice) => <MenuItem key={choice.value} value={choice.value}>{choice.name}</MenuItem>) : null}
										</TextField>}
									</Grid>
									<Grid item><Button aria-label={control.name} disabled={busy || unavailable || !valid} onClick={() => apply(control)}>{control.type === 'button' ? <Trans>Run</Trans> : <Trans>Apply</Trans>}</Button></Grid>
								</Grid>
							</Grid>
						);
					})}
				</Grid>
			</AccordionDetails>
		</Accordion>
	);
}
