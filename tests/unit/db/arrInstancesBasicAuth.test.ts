/**
 * Basic Auth on arr_instances is saved as a pair: create and update refuse a
 * username without a password or a password without a username, so every
 * caller, including future API routes, gets the same rule as the forms.
 */

import { afterAll, describe, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { assertEquals, assertThrows } from '@std/assert';

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
		assertThrows(() =>
			arrInstancesQueries.create({
				...base,
				name: 'Password Only',
				url: 'http://password-only.local',
				basicAuthPassword: 'secret'
			})
		);
		assertEquals(arrInstancesQueries.nameExists('Password Only'), false);
	});

	test('create rejects a username without a password', () => {
		assertThrows(() =>
			arrInstancesQueries.create({
				...base,
				name: 'Username Only',
				url: 'http://username-only.local',
				basicAuthUsername: 'user'
			})
		);
		assertEquals(arrInstancesQueries.nameExists('Username Only'), false);
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

		assertThrows(() => arrInstancesQueries.update(id, { basicAuthUsername: null }));
		const row = arrInstancesQueries.getById(id)!;
		assertEquals(row.basic_auth_username, 'user');
		assertEquals(row.basic_auth_password, 'secret');
	});

	test('update can change only the password', () => {
		arrInstancesQueries.update(id, { basicAuthPassword: 'new-secret' });
		const row = arrInstancesQueries.getById(id)!;
		assertEquals(row.basic_auth_username, 'user');
		assertEquals(row.basic_auth_password, 'new-secret');
	});

	test('update can clear both', () => {
		arrInstancesQueries.update(id, { basicAuthUsername: null, basicAuthPassword: null });
		const row = arrInstancesQueries.getById(id)!;
		assertEquals(row.basic_auth_username, null);
		assertEquals(row.basic_auth_password, null);
	});
});
