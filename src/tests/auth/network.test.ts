/**
 * Tests for isLocalAddress IP classification and getClientIp proxy header handling
 */

import { assertEquals } from '@std/assert';
import { isLocalAddress, getClientIp } from '$auth/network.ts';

// IPv4 loopback
Deno.test('isLocalAddress: loopback 127.0.0.1', () => {
	assertEquals(isLocalAddress('127.0.0.1'), true);
});

Deno.test('isLocalAddress: loopback 127.255.255.255', () => {
	assertEquals(isLocalAddress('127.255.255.255'), true);
});

// IPv4 Class A private
Deno.test('isLocalAddress: class A 10.0.0.1', () => {
	assertEquals(isLocalAddress('10.0.0.1'), true);
});

Deno.test('isLocalAddress: class A 10.255.255.255', () => {
	assertEquals(isLocalAddress('10.255.255.255'), true);
});

// IPv4 Class B private
Deno.test('isLocalAddress: class B 172.16.0.1', () => {
	assertEquals(isLocalAddress('172.16.0.1'), true);
});

Deno.test('isLocalAddress: class B 172.31.255.255', () => {
	assertEquals(isLocalAddress('172.31.255.255'), true);
});

Deno.test('isLocalAddress: class B boundary low 172.15.0.1 is public', () => {
	assertEquals(isLocalAddress('172.15.0.1'), false);
});

Deno.test('isLocalAddress: class B boundary high 172.32.0.1 is public', () => {
	assertEquals(isLocalAddress('172.32.0.1'), false);
});

// IPv4 Class C private
Deno.test('isLocalAddress: class C 192.168.0.1', () => {
	assertEquals(isLocalAddress('192.168.0.1'), true);
});

Deno.test('isLocalAddress: class C 192.168.1.100', () => {
	assertEquals(isLocalAddress('192.168.1.100'), true);
});

Deno.test('isLocalAddress: 192.167.1.1 is public', () => {
	assertEquals(isLocalAddress('192.167.1.1'), false);
});

// IPv4 link-local
Deno.test('isLocalAddress: link-local 169.254.0.1', () => {
	assertEquals(isLocalAddress('169.254.0.1'), true);
});

Deno.test('isLocalAddress: 169.253.0.1 is public', () => {
	assertEquals(isLocalAddress('169.253.0.1'), false);
});

// IPv4 public
Deno.test('isLocalAddress: public 8.8.8.8', () => {
	assertEquals(isLocalAddress('8.8.8.8'), false);
});

Deno.test('isLocalAddress: public 1.1.1.1', () => {
	assertEquals(isLocalAddress('1.1.1.1'), false);
});

// IPv6
Deno.test('isLocalAddress: IPv6 loopback ::1', () => {
	assertEquals(isLocalAddress('::1'), true);
});

Deno.test('isLocalAddress: IPv6 link-local fe80::1', () => {
	assertEquals(isLocalAddress('fe80::1'), true);
});

Deno.test('isLocalAddress: IPv6 unique local fc00::1', () => {
	assertEquals(isLocalAddress('fc00::1'), true);
});

Deno.test('isLocalAddress: IPv6 unique local fd00::1', () => {
	assertEquals(isLocalAddress('fd00::1'), true);
});

Deno.test('isLocalAddress: IPv6 site-local fec0::1', () => {
	assertEquals(isLocalAddress('fec0::1'), true);
});

Deno.test('isLocalAddress: IPv6 public 2001:db8::1', () => {
	assertEquals(isLocalAddress('2001:db8::1'), false);
});

// IPv6-mapped IPv4
Deno.test('isLocalAddress: IPv6-mapped private ::ffff:192.168.1.1', () => {
	assertEquals(isLocalAddress('::ffff:192.168.1.1'), true);
});

Deno.test('isLocalAddress: IPv6-mapped public ::ffff:8.8.8.8', () => {
	assertEquals(isLocalAddress('::ffff:8.8.8.8'), false);
});

// Invalid input
Deno.test('isLocalAddress: invalid string', () => {
	assertEquals(isLocalAddress('not-an-ip'), false);
});

Deno.test('isLocalAddress: empty string', () => {
	assertEquals(isLocalAddress(''), false);
});

// --- getClientIp: X-Forwarded-For spoofing ---

function mockEvent(tcpAddress: string, headers: Record<string, string> = {}) {
	return {
		getClientAddress: () => tcpAddress,
		request: new Request('http://localhost', { headers })
	};
}

Deno.test('getClientIp: trustProxy=false ignores X-Forwarded-For', () => {
	const event = mockEvent('45.33.32.1', { 'X-Forwarded-For': '192.168.1.1' });
	assertEquals(getClientIp(event, false), '45.33.32.1');
});

Deno.test('getClientIp: trustProxy=false — spoofed local IP does not appear local', () => {
	const event = mockEvent('45.33.32.1', { 'X-Forwarded-For': '192.168.1.1' });
	const ip = getClientIp(event, false);
	assertEquals(isLocalAddress(ip), false);
});

Deno.test('getClientIp: trustProxy=true reads X-Forwarded-For', () => {
	const event = mockEvent('10.0.0.5', { 'X-Forwarded-For': '203.0.113.50' });
	assertEquals(getClientIp(event, true), '203.0.113.50');
});

Deno.test('getClientIp: trustProxy=true takes first IP from comma-separated list', () => {
	const event = mockEvent('10.0.0.5', { 'X-Forwarded-For': '203.0.113.50, 10.0.0.5' });
	assertEquals(getClientIp(event, true), '203.0.113.50');
});

Deno.test('getClientIp: trustProxy=false ignores all proxy headers', () => {
	const event = mockEvent('45.33.32.1', {
		'X-Forwarded-For': '192.168.1.1',
		'X-Real-Ip': '10.0.0.1',
		'CF-Connecting-IP': '172.16.0.1'
	});
	assertEquals(getClientIp(event, false), '45.33.32.1');
});

Deno.test('getClientIp: trustProxy=true falls back to getClientAddress when no headers', () => {
	const event = mockEvent('203.0.113.99');
	assertEquals(getClientIp(event, true), '203.0.113.99');
});
