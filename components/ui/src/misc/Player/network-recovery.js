// Live HLS can return 404 until the first camera GOP has completed. Retrying
// only once in the error event leaves the second failure latched forever.
export function installNetworkRecovery(player, retryDelay = 5000) {
	let timer = null;
	let disposed = false;
	const clear = () => {
		if (timer !== null) clearTimeout(timer);
		timer = null;
	};
	const recover = () => {
		if (disposed || player.isDisposed() || player.error()?.code !== 2 || timer !== null) return;
		const resume = !player.paused() || !!player.autoplay();
		timer = setTimeout(() => {
			timer = null;
			if (disposed || player.isDisposed() || player.error()?.code !== 2) return;
			const source = player.currentSource();
			if (!source?.src) return;
			player.error(null);
			player.src(source);
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
