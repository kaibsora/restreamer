import { normalizeRTMPApp, normalizeRTMPAppConfig } from './rtmp';

test.each([
	['', ''],
	['/', ''],
	['///', ''],
	['live', '/live'],
	['/live', '/live'],
	['live/', '/live'],
	['/live/', '/live'],
	['//live///camera//', '/live/camera'],
])('normalizes RTMP URL application %j', (input, expected) => {
	expect(normalizeRTMPApp(input)).toBe(expected);
});

test.each([
	['', '/'],
	['/', '/'],
	['/live/', '/live'],
])('normalizes RTMP Core configuration application %j', (input, expected) => {
	expect(normalizeRTMPAppConfig(input)).toBe(expected);
});
