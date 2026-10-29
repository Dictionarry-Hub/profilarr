/**
 * Basic Auth on arr_instances is saved as a pair: create and update refuse a
 * username without a password or a password without a username, so every
 * caller, including future API routes, gets the same rule as the forms.
 */

import { afterAll, describe, expect, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';

describe('arr_instances Basic Auth pair', async () => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await mkdtemp(join(tmpdir(), 'profilarr-basic-auth-'));
	process.env.APP_BASE_PATH = baseDir;

	const { db } = await import('#db/db.ts');
	const { runMigrations } = await import('#db/migrations.ts');
	const { arrInstancesQueries } = await import('#db/queries/arrInstances.ts');

	const base = { type: 'sonarr', apiKey: 'test-api-key' };

	afterAll(async () => {
		db.close();
		await rm(baseDir, { recursive: true });
	});

	await db.initialize();
	await runMigrations();

	test('create rejects a password without a username', () => {
		expect(() =>
			arrInstancesQueries.create({
				...base,
				name: 'Password Only',
				url: 'http://password-only.local',
				basicAuthPassword: 'secret'
			})
		).toThrow();
		expect(arrInstancesQueries.nameExists('Password Only')).toStrictEqual(false);
	});

	test('create rejects a username without a password', () => {
		expect(() =>
			arrInstancesQueries.create({
				...base,
				name: 'Username Only',
				url: 'http://username-only.local',
				basicAuthUsername: 'user'
			})
		).toThrow();
		expect(arrInstancesQueries.nameExists('Username Only')).toStrictEqual(false);
	});

	let id: number;

	test('update rejects clearing only the username', () => {
		id = arrInstancesQueries.create({
			...base,
			name: 'Proxied',
			url: 'http://proxied.local',
			basicAuthUsername: 'user',
			basicAuthPassword: 'secret'
		});

		expect(() => arrInstancesQueries.update(id, { basicAuthUsername: null })).toThrow();
		const row = arrInstancesQueries.getById(id)!;
		expect(row.basic_auth_username).toStrictEqual('user');
		expect(row.basic_auth_password).toStrictEqual('secret');
	});

	test('update can change only the password', () => {
		arrInstancesQueries.update(id, { basicAuthPassword: 'new-secret' });
		const row = arrInstancesQueries.getById(id)!;
		expect(row.basic_auth_username).toStrictEqual('user');
		expect(row.basic_auth_password).toStrictEqual('new-secret');
	});

	test('update can clear both', () => {
		arrInstancesQueries.update(id, { basicAuthUsername: null, basicAuthPassword: null });
		const row = arrInstancesQueries.getById(id)!;
		expect(row.basic_auth_username).toStrictEqual(null);
		expect(row.basic_auth_password).toStrictEqual(null);
	});
});
