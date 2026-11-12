import { createCameraControlQueue } from './cameraControlQueue';

const brightness = { id: 10, type: 'integer', value: 128, supported: true };
const flushPromises = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
let queue;
beforeEach(() => vi.useFakeTimers());
afterEach(() => { queue?.dispose(); vi.useRealTimers(); });

function setup(write = vi.fn().mockImplementation(async (_, value) => [[{ ...brightness, value }], null])) {
	const callbacks = { write, onReadback: vi.fn(), onError: vi.fn(), onBusy: vi.fn() };
	queue = createCameraControlQueue(callbacks);
	queue.update([brightness]);
	return callbacks;
}

test('throttles drag updates to the newest value and flushes release without waiting', async () => {
	const { write } = setup();
	queue.change(10, 129);
	await flushPromises();
	queue.change(10, 130);
	await vi.advanceTimersByTimeAsync(50);
	queue.change(10, 140);
	await vi.advanceTimersByTimeAsync(99);
	expect(write).toHaveBeenCalledTimes(1);
	await vi.advanceTimersByTimeAsync(1);
	expect(write).toHaveBeenLastCalledWith(10, 140);
	queue.change(10, 150, true);
	await flushPromises();
	expect(write).toHaveBeenCalledTimes(3);
	expect(write).toHaveBeenLastCalledWith(10, 150);
	queue.change(10, 150, true);
	expect(write).toHaveBeenCalledTimes(3);
});

test('serializes a slow write, preserves the newer thumb and sends the final queued value', async () => {
	let finish;
	const write = vi.fn().mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }))
		.mockImplementation(async (_, value) => [[{ ...brightness, value }], null]);
	const { onReadback } = setup(write);
	queue.change(10, 129);
	queue.change(10, 130);
	queue.change(10, 140, true);
	expect(write).toHaveBeenCalledTimes(1);
	finish([[{ ...brightness, value: 129 }], null]);
	await flushPromises();
	expect(onReadback.mock.calls[0][1]).toEqual({ 10: 140 });
	expect(write).toHaveBeenCalledTimes(2);
	expect(write).toHaveBeenLastCalledWith(10, 140);
});

test('returning to the confirmed value cancels a queued write and clears busy state', async () => {
	const { write, onBusy } = setup();
	queue.change(10, 129);
	await flushPromises();
	queue.change(10, 130);
	queue.change(10, 129, true);
	await vi.advanceTimersByTimeAsync(500);
	expect(write).toHaveBeenCalledTimes(1);
	expect(onBusy).toHaveBeenLastCalledWith(false);
});

test('a device change cancels trailing writes and ignores the old response', async () => {
	let finish;
	const { write, onReadback } = setup(vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; })));
	queue.change(10, 129);
	queue.change(10, 130, true);
	queue.dispose();
	finish([[{ ...brightness, value: 129 }], null]);
	await flushPromises();
	await vi.advanceTimersByTimeAsync(1000);
	expect(write).toHaveBeenCalledTimes(1);
	expect(onReadback).not.toHaveBeenCalled();
});

test('driver errors discard pending writes, roll back optimistic values and do not retry', async () => {
	const error = new Error('Camera is busy');
	const { write, onError, onReadback, onBusy } = setup(vi.fn().mockResolvedValue([null, error]));
	queue.change(10, 129);
	queue.change(10, 130, true);
	await flushPromises();
	await vi.advanceTimersByTimeAsync(1000);
	expect(write).toHaveBeenCalledTimes(1);
	expect(onReadback).toHaveBeenCalledWith([brightness], {});
	expect(onError).toHaveBeenCalledWith(error);
	expect(onBusy).toHaveBeenLastCalledWith(false);
});

test('a mode readback cancels pending manual controls that became inactive', async () => {
	let finish;
	const { write, onReadback } = setup(vi.fn().mockReturnValue(new Promise((resolve) => { finish = resolve; })));
	const automatic = { id: 20, type: 'boolean', value: 0, supported: true };
	queue.update([brightness, automatic]);
	queue.change(20, 1);
	queue.change(10, 150, true);
	finish([[{ ...brightness, inactive: true }, { ...automatic, value: 1 }], null]);
	await flushPromises();
	await vi.advanceTimersByTimeAsync(500);
	expect(write).toHaveBeenCalledTimes(1);
	expect(onReadback.mock.calls[0][1]).toEqual({});
});
