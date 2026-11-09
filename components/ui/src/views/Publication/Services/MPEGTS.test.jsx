import Services from './index';
import * as MPEGTS from './MPEGTS';

test('registers MPEG-TS with UDP and RTP output support', () => {
	const service = Services.Get('mpegts');

	expect(service).not.toBe(null);
	expect(service.requires.protocols).toEqual(['udp', 'tcp', 'rtp']);
	expect(service.requires.formats).toEqual(['mpegts', 'rtp_mpegts']);
});

test('keeps existing UDP publications on the MPEG-TS muxer', () => {
	const output = MPEGTS.createOutput(
		MPEGTS.init({
			address: '239.255.0.1:5001',
		}),
	);

	expect(output.address).toBe('udp://239.255.0.1:5001');
	expect(output.options.slice(0, 2)).toEqual(['-f', 'mpegts']);
});

test('creates RTP/MPEG-TS multicast output with safe packet defaults', () => {
	const settings = MPEGTS.init({
		protocol: 'rtp://',
		address: '239.255.0.1:5001',
	});
	const output = MPEGTS.createOutput(settings);

	expect(settings.params).toEqual({ pkt_size: '1316', ttl: '1' });
	expect(output.address).toBe('rtp://239.255.0.1:5001?pkt_size=1316&ttl=1');
	expect(output.options.slice(0, 4)).toEqual(['-bsf:v', 'dump_extra', '-f', 'rtp_mpegts']);
	expect(output.options).toEqual(expect.arrayContaining(['-mpegts_transport_stream_id', '0x0001', '-pat_period', '0.1']));
});

test('preserves explicit RTP parameters and an existing destination query', () => {
	const output = MPEGTS.createOutput(
		MPEGTS.init({
			protocol: 'rtp://',
			address: '239.255.0.2:5002?connect=1',
			params: { pkt_size: '1200', ttl: '4' },
		}),
	);

	expect(output.address).toBe('rtp://239.255.0.2:5002?connect=1&pkt_size=1200&ttl=4');
});

test('does not append datagram parameters to TCP output', () => {
	const output = MPEGTS.createOutput(
		MPEGTS.init({
			protocol: 'tcp://',
			address: 'relay.lan:5001',
			params: { pkt_size: '1316', ttl: '1' },
		}),
	);

	expect(output.address).toBe('tcp://relay.lan:5001');
	expect(output.options.slice(0, 2)).toEqual(['-f', 'mpegts']);
});
