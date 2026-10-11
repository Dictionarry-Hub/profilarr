/**
 * SQL time comparisons must keep milliseconds. `datetime()` drops them, so a
 * time later in the current second compares as already reached; the job queue
 * then claimed jobs early and looped (#948).
 *
 * Every check uses a time later in the current second, which must not count as
 * reached yet, and one a second ago, which must.
 */

import { assertEquals, assertExists } from '@std/assert';

/** Waits until just after a wall-clock second starts and returns that second in ms. */
async function startOfSecond(): Promise<number> {
	while (true) {
		const now = Date.now();
		const into = now % 1000;
		if (into < 50) return now - into;
		await new Promise((resolve) => setTimeout(resolve, 1000 - into));
	}
}

async function times(): Promise<{ later: string; earlier: string; at: (ms: number) => string }> {
	const second = await startOfSecond();
	const at = (offsetMs: number) => new Date(second + offsetMs).toISOString();
	return { later: at(900), earlier: at(-1000), at };
}

Deno.test('SQL time comparisons keep milliseconds', async (t) => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await Deno.makeTempDir({ prefix: 'profilarr-time-comparisons-' });
	Deno.env.set('APP_BASE_PATH', baseDir);

	const { db } = await import('$db/db.ts');
	const { runMigrations } = await import('$db/migrations.ts');
	const { jobQueueQueries } = await import('$db/queries/jobQueue.ts');
	const { sessionsQueries } = await import('$db/queries/sessions.ts');
	const { githubCacheQueries } = await import('$db/queries/githubCache.ts');
	const { databaseInstancesQueries } = await import('$db/queries/databaseInstances.ts');
	const { upgradeConfigsQueries } = await import('$db/queries/upgradeConfigs.ts');
	const { arrRenameSettingsQueries } = await import('$db/queries/arrRenameSettings.ts');
	const { arrCleanupSettingsQueries } = await import('$db/queries/arrCleanupSettings.ts');
	const { arrDriftSettingsQueries } = await import('$db/queries/arrDriftSettings.ts');

	const lastId = () => db.queryFirst<{ id: number }>('SELECT last_insert_rowid() AS id')!.id;

	try {
		await db.initialize();
		await runMigrations();

		await t.step('job queue does not claim a job before it is due', async () => {
			const { later, earlier } = await times();
			db.execute(`INSERT INTO job_queue (job_type, run_at) VALUES ('test.later', ?)`, later);
			assertEquals(jobQueueQueries.getNextDueQueued(), undefined);

			db.execute(`INSERT INTO job_queue (job_type, run_at) VALUES ('test.earlier', ?)`, earlier);
			assertEquals(jobQueueQueries.getNextDueQueued()?.jobType, 'test.earlier');
		});

		await t.step('sessions stay valid until they expire', async () => {
			db.execute(`INSERT INTO users (username, password_hash) VALUES ('time-test', 'x')`);
			const userId = lastId();
			const { later, earlier } = await times();
			db.execute(
				`INSERT INTO sessions (id, user_id, expires_at) VALUES ('later', ?, ?)`,
				userId,
				later
			);
			db.execute(
				`INSERT INTO sessions (id, user_id, expires_at) VALUES ('earlier', ?, ?)`,
				userId,
				earlier
			);

			assertExists(sessionsQueries.getValidById('later'));
			assertEquals(sessionsQueries.getValidById('earlier'), undefined);
			assertEquals(sessionsQueries.countByUserId(userId), 1);
			assertEquals(sessionsQueries.deleteExpired(), 1);
			assertExists(sessionsQueries.getById('later'));
		});

		await t.step('GitHub cache entries stay fresh until they expire', async () => {
			const { later, earlier } = await times();
			const insert = `INSERT INTO github_cache (cache_key, cache_type, data, expires_at) VALUES (?, 'repo_info', '{}', ?)`;
			db.execute(insert, 'later', later);
			db.execute(insert, 'earlier', earlier);

			assertExists(githubCacheQueries.get('later'));
			assertEquals(githubCacheQueries.get('earlier'), null);
			assertEquals(githubCacheQueries.isExpired('later'), false);
			assertEquals(githubCacheQueries.isExpired('earlier'), true);
			assertEquals(githubCacheQueries.deleteExpired(), 1);
		});

		await t.step('databases are not due for sync early', async () => {
			const { at } = await times();
			const insert = `INSERT INTO database_instances (uuid, name, repository_url, local_path, sync_strategy, last_synced_at)
				VALUES (?, ?, 'https://example.com/db.git', '/tmp/db', 1, ?)`;
			// Synced every minute, so due one minute after the last sync
			db.execute(insert, 'uuid-later', 'later', at(900 - 60_000));
			db.execute(insert, 'uuid-earlier', 'earlier', at(-1000 - 60_000));

			const due = databaseInstancesQueries.getDueForSync().map((instance) => instance.name);
			assertEquals(due, ['earlier']);
		});

		await t.step('scheduled configs are not due early', async () => {
			const insertArr = `INSERT INTO arr_instances (name, type, url, api_key) VALUES (?, 'radarr', 'http://localhost:7878', 'key')`;
			db.execute(insertArr, 'later');
			const laterArr = lastId();
			db.execute(insertArr, 'earlier');
			const earlierArr = lastId();

			const { later, earlier } = await times();
			const tables = [
				'upgrade_configs',
				'arr_rename_settings',
				'arr_cleanup_settings',
				'arr_drift_settings'
			];
			for (const table of tables) {
				const insert = `INSERT INTO ${table} (arr_instance_id, enabled, next_run_at) VALUES (?, 1, ?)`;
				db.execute(insert, laterArr, later);
				db.execute(insert, earlierArr, earlier);
			}

			const dueIds = [
				upgradeConfigsQueries.getDueConfigs(),
				arrRenameSettingsQueries.getDueConfigs(),
				arrCleanupSettingsQueries.getDueConfigs(),
				arrDriftSettingsQueries.getDueConfigs()
			].map((configs) => configs.map((config) => config.arrInstanceId));
			assertEquals(dueIds, [[earlierArr], [earlierArr], [earlierArr], [earlierArr]]);
		});
	} finally {
		db.close();
		await Deno.remove(baseDir, { recursive: true });
	}
});
