/**
 * Basic Auth on arr_instances is saved as a pair: create and update refuse a
 * username without a password or a password without a username, so every
 * caller, including future API routes, gets the same rule as the forms.
 */

import { assertEquals, assertThrows } from '@std/assert';

Deno.test('arr_instances Basic Auth pair', async (t) => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await Deno.makeTempDir({ prefix: 'profilarr-basic-auth-' });
	Deno.env.set('APP_BASE_PATH', baseDir);

	const { db } = await import('$db/db.ts');
	const { runMigrations } = await import('$db/migrations.ts');
	const { arrInstancesQueries } = await import('$db/queries/arrInstances.ts');

	const base = { type: 'sonarr', apiKey: 'test-api-key' };

	try {
		await db.initialize();
		await runMigrations();

		await t.step('create rejects a password without a username', () => {
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

		await t.step('create rejects a username without a password', () => {
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

		const id = arrInstancesQueries.create({
			...base,
			name: 'Proxied',
			url: 'http://proxied.local',
			basicAuthUsername: 'user',
			basicAuthPassword: 'secret'
		});

		await t.step('update rejects clearing only the username', () => {
			assertThrows(() => arrInstancesQueries.update(id, { basicAuthUsername: null }));
			const row = arrInstancesQueries.getById(id)!;
			assertEquals(row.basic_auth_username, 'user');
			assertEquals(row.basic_auth_password, 'secret');
		});

		await t.step('update can change only the password', () => {
			arrInstancesQueries.update(id, { basicAuthPassword: 'new-secret' });
			const row = arrInstancesQueries.getById(id)!;
			assertEquals(row.basic_auth_username, 'user');
			assertEquals(row.basic_auth_password, 'new-secret');
		});

		await t.step('update can clear both', () => {
			arrInstancesQueries.update(id, { basicAuthUsername: null, basicAuthPassword: null });
			const row = arrInstancesQueries.getById(id)!;
			assertEquals(row.basic_auth_username, null);
			assertEquals(row.basic_auth_password, null);
		});
	} finally {
		db.close();
		await Deno.remove(baseDir, { recursive: true });
	}
});
