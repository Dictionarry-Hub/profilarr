/**
 * Tests for getClientIp proxy header handling
 */

import { test } from 'vitest';
import { assertEquals } from '@std/assert';
import { getClientIp } from '#utils/auth/network.ts';

// --- getClientIp: X-Forwarded-For spoofing ---

function mockEvent(tcpAddress: string, headers: Record<string, string> = {}) {
	return {
		getClientAddress: () => tcpAddress,
		request: new Request('http://localhost', { headers })
	};
}

test('getClientIp: trustProxy=false ignores X-Forwarded-For', () => {
	const event = mockEvent('45.33.32.1', { 'X-Forwarded-For': '192.168.1.1' });
	assertEquals(getClientIp(event, false), '45.33.32.1');
});

test('getClientIp: trustProxy=true reads X-Forwarded-For', () => {
	const event = mockEvent('10.0.0.5', { 'X-Forwarded-For': '203.0.113.50' });
	assertEquals(getClientIp(event, true), '203.0.113.50');
});

test('getClientIp: trustProxy=true takes first IP from comma-separated list', () => {
	const event = mockEvent('10.0.0.5', { 'X-Forwarded-For': '203.0.113.50, 10.0.0.5' });
	assertEquals(getClientIp(event, true), '203.0.113.50');
});

test('getClientIp: trustProxy=false ignores all proxy headers', () => {
	const event = mockEvent('45.33.32.1', {
		'X-Forwarded-For': '192.168.1.1',
		'X-Real-Ip': '10.0.0.1',
		'CF-Connecting-IP': '172.16.0.1'
	});
	assertEquals(getClientIp(event, false), '45.33.32.1');
});

test('getClientIp: trustProxy=true falls back to getClientAddress when no headers', () => {
	const event = mockEvent('203.0.113.99');
	assertEquals(getClientIp(event, true), '203.0.113.99');
});
