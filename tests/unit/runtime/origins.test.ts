import { describe, expect, test } from 'vitest';
import { parseOrigins, resolveOrigin } from '#runtime/origins.js';

describe('parseOrigins', () => {
	test('accepts no configured origin', () => {
		expect(parseOrigins(undefined)).toEqual([]);
		expect(parseOrigins('  ')).toEqual([]);
	});

	test('normalizes one or more origins', () => {
		expect(parseOrigins(' http://192.168.1.10:6868/, https://Profilarr.Example.com:443 ')).toEqual([
			{
				origin: 'http://192.168.1.10:6868',
				protocol: 'http',
				hostname: '192.168.1.10',
				port: '6868',
				explicitPort: true,
				host: '192.168.1.10:6868'
			},
			{
				origin: 'https://profilarr.example.com',
				protocol: 'https',
				hostname: 'profilarr.example.com',
				port: '443',
				explicitPort: false,
				host: 'profilarr.example.com'
			}
		]);
	});

	test.each([
		'https://profilarr.example.com/path',
		'https://profilarr.example.com?query=1',
		'ftp://profilarr.example.com',
		'not a URL',
		'https://one.example.com,,https://two.example.com'
	])('rejects invalid origin value %s', (origin) => {
		expect(() => parseOrigins(origin)).toThrow();
	});
});

describe('resolveOrigin', () => {
	test('uses the socket and Host when ORIGIN is unset', () => {
		expect(
			resolveOrigin(
				{
					host: '192.168.1.10:6868',
					'x-forwarded-host': 'profilarr.example.com',
					'x-forwarded-proto': 'https'
				},
				false,
				[]
			)
		).toBe('http://192.168.1.10:6868');
	});

	test('preserves one fixed legacy origin', () => {
		const origins = parseOrigins('https://profilarr.example.com');
		expect(resolveOrigin({ host: 'internal:6868' }, false, origins)).toBe(
			'https://profilarr.example.com'
		);
	});

	test('selects direct and proxied origins from one list', () => {
		const origins = parseOrigins('http://192.168.1.10:6868,https://profilarr.example.com:8443');
		expect(resolveOrigin({ host: '192.168.1.10:6868' }, false, origins)).toBe(
			'http://192.168.1.10:6868'
		);
		expect(
			resolveOrigin(
				{
					host: '192.168.1.10:6868',
					'x-forwarded-host': 'profilarr.example.com',
					'x-forwarded-proto': 'https',
					'x-forwarded-port': '8443'
				},
				false,
				origins
			)
		).toBe('https://profilarr.example.com:8443');
	});

	test('ignores an unlisted forwarded host when Host matches', () => {
		const origins = parseOrigins('http://192.168.1.10:6868,https://profilarr.example.com:8443');
		expect(
			resolveOrigin(
				{
					host: '192.168.1.10:6868',
					'x-forwarded-host': 'evil.example.com',
					'x-forwarded-proto': 'https'
				},
				false,
				origins
			)
		).toBe('http://192.168.1.10:6868');
	});

	test('rejects unknown and malformed origin metadata', () => {
		const origins = parseOrigins('http://192.168.1.10:6868,https://profilarr.example.com');
		expect(resolveOrigin({ host: 'unknown.internal' }, false, origins)).toBeUndefined();
		expect(
			resolveOrigin(
				{
					host: 'unknown.internal',
					'x-forwarded-host': 'profilarr.example.com',
					'x-forwarded-proto': 'https:',
					'x-forwarded-port': 'not-a-port'
				},
				false,
				origins
			)
		).toBeUndefined();
	});

	test('uses the forwarded scheme to disambiguate one authority', () => {
		const origins = parseOrigins('http://profilarr.example.com,https://profilarr.example.com');
		expect(
			resolveOrigin(
				{
					host: 'profilarr.example.com',
					'x-forwarded-proto': 'https'
				},
				false,
				origins
			)
		).toBe('https://profilarr.example.com');
	});
});
