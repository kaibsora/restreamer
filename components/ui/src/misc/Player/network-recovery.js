// Live HLS can return 404 until the first camera GOP has completed. Retrying
// only once in the error event leaves the second failure latched forever.
export function installNetworkRecovery(player, retryDelay = 5000, originalSource = player.currentSource()) {
	const source = { ...originalSource };
	let timer = null;
	let disposed = false;
	const clear = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
	};
	const recover = () => {
		if (disposed || player.isDisposed()) return;
		if (player.error()?.code !== 2) {
			clear();
			return;
		}
		if (timer !== null) return;
		const resume = !player.paused() || !!player.autoplay();
		timer = setTimeout(() => {
			timer = null;
			// Video.js may clear error() during loadstart before metadata arrives.
			// The scheduled network failure still needs recovery in that state.
			if (disposed || player.isDisposed()) return;
			if (!source?.src) return;
			player.error(null);
			player.src({ ...source });
			if (resume) player.play()?.catch(() => {});
		}, retryDelay);
	};
	const dispose = () => {
		disposed = true;
		clear();
		player.off('error', recover);
		player.off('loadedmetadata', clear);
	};
	player.on('error', recover);
	player.on('loadedmetadata', clear);
	player.one('dispose', dispose);
	return dispose;
}
