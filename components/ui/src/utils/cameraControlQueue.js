// One write at a time per camera. Dragging replaces pending values instead of
// accumulating requests; committing the thumb flushes the final value.
export function createCameraControlQueue({ write, onReadback, onError, onBusy, interval = 150 }) {
	let active = true;
	let timer = null;
	let inFlight = null;
	let lastStarted = -Infinity;
	let flush = false;
	let controls = new Map();
	const pending = new Map();
	const writable = (control) => control && control.supported && !control.inactive && !control.read_only;

	function update(values) {
		controls = new Map(values.map((control) => [control.id, control]));
		for (const id of pending.keys()) {
			if (!writable(controls.get(id))) pending.delete(id);
		}
	}

	function schedule(commit = false) {
		if (!active) return;
		if (!pending.size) {
			if (timer !== null) { clearTimeout(timer); timer = null; }
			if (!inFlight) { flush = false; onBusy(false); }
			return;
		}
		flush ||= commit;
		if (inFlight) return;
		if (timer !== null) { clearTimeout(timer); timer = null; }
		const delay = flush ? 0 : Math.max(0, interval - (Date.now() - lastStarted));
		if (delay === 0) void pump();
		else timer = setTimeout(() => { timer = null; void pump(); }, delay);
	}

	async function pump() {
		if (!active || inFlight || !pending.size) return;
		const [id, value] = pending.entries().next().value;
		pending.delete(id);
		inFlight = { id, value };
		flush = false;
		lastStarted = Date.now();
		try {
			const [values, error] = await write(id, value);
			if (!active) return;
			if (error) throw error;
			if (!Array.isArray(values)) throw new Error('Invalid camera control response');
			update(values);
			onReadback(values, Object.fromEntries(pending));
		} catch (error) {
			if (!active) return;
			pending.clear();
			flush = false;
			// Stop on error and read actual values back. Never automatically retry
			// a failing driver or leave an optimistic thumb presented as confirmed.
			onReadback([...controls.values()], {});
			await onError(error);
		} finally {
			inFlight = null;
			if (active) {
				if (pending.size) schedule();
				else { flush = false; onBusy(false); }
			}
		}
	}

	return {
		update,
		change(id, value, commit = false) {
			const control = controls.get(id);
			if (!active || !writable(control) || !Number.isSafeInteger(value)) return;
			if (control.type !== 'button') {
				if (inFlight?.id === id && inFlight.value === value) pending.delete(id);
				else if (inFlight?.id !== id && control.value === value) pending.delete(id);
				else pending.set(id, value);
			} else pending.set(id, value);
			if (inFlight || pending.size) onBusy(true);
			schedule(commit);
		},
		dispose() {
			active = false;
			if (timer !== null) clearTimeout(timer);
			pending.clear();
		},
	};
}
