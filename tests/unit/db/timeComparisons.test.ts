/**
 * SQL time comparisons must keep milliseconds. `datetime()` drops them, so a
 * time later in the current second compares as already reached; the job queue
 * then claimed jobs early and looped (#948).
 *
 * Every check uses a time later in the current second, which must not count as
 * reached yet, and one a second ago, which must. Retention deletes also check a
 * time just before the cutoff in the same second, which must count as older.
 */

import { afterAll, describe, test } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { assertEquals, assertExists } from '@std/assert';

/**
 * Waits until 5-50ms into a wall-clock second and returns that second in ms.
 * The 5ms floor keeps `now` strictly after the second's start.
 */
async function startOfSecond(): Promise<number> {
	while (true) {
		const now = Date.now();
		const into = now % 1000;
		if (into >= 5 && into < 50) return now - into;
		await new Promise((resolve) => setTimeout(resolve, into < 5 ? 5 - into : 1005 - into));
	}
}

async function times(): Promise<{ later: string; earlier: string; at: (ms: number) => string }> {
	const second = await startOfSecond();
	const at = (offsetMs: number) => new Date(second + offsetMs).toISOString();
	return { later: at(900), earlier: at(-1000), at };
}

describe('SQL time comparisons keep milliseconds', async () => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await mkdtemp(join(tmpdir(), 'profilarr-time-comparisons-'));
	process.env.APP_BASE_PATH = baseDir;

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
	const { loginAttemptsQueries } = await import('$db/queries/loginAttempts.ts');
	const { notificationHistoryQueries } = await import('$db/queries/notificationHistory.ts');
	const { renameRunsQueries } = await import('$db/queries/renameRuns.ts');
	const { upgradeRunsQueries } = await import('$db/queries/upgradeRuns.ts');

	const lastId = () => db.queryFirst<{ id: number }>('SELECT last_insert_rowid() AS id')!.id;

	afterAll(async () => {
		db.close();
		await rm(baseDir, { recursive: true });
	});

	await db.initialize();
	await runMigrations();

	test('job queue does not claim a job before it is due', async () => {
		const { later, earlier } = await times();
		db.execute(`INSERT INTO job_queue (job_type, run_at) VALUES ('test.later', ?)`, later);
		assertEquals(jobQueueQueries.getNextDueQueued(), undefined);

		db.execute(`INSERT INTO job_queue (job_type, run_at) VALUES ('test.earlier', ?)`, earlier);
		assertEquals(jobQueueQueries.getNextDueQueued()?.jobType, 'test.earlier');
	});

	test('sessions stay valid until they expire', async () => {
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

	test('GitHub cache entries stay fresh until they expire', async () => {
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

	test('databases are not due for sync early', async () => {
		const { at } = await times();
		const insert = `INSERT INTO database_instances (uuid, name, repository_url, local_path, sync_strategy, last_synced_at)
			VALUES (?, ?, 'https://example.com/db.git', '/tmp/db', 1, ?)`;
		// Synced every minute, so due one minute after the last sync
		db.execute(insert, 'uuid-later', 'later', at(900 - 60_000));
		db.execute(insert, 'uuid-earlier', 'earlier', at(-1000 - 60_000));

		const due = databaseInstancesQueries.getDueForSync().map((instance) => instance.name);
		assertEquals(due, ['earlier']);
	});

	test('scheduled configs are not due early', async () => {
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

	test('login attempts stay in the rate-limit window until they leave it', async () => {
		const { at } = await times();
		const insert = `INSERT INTO login_attempts (ip, endpoint, category, failed_at)
			VALUES ('10.0.0.1', '/auth/login', 'typo', ?)`;
		// A one-minute window: one attempt still inside it, one just outside
		db.execute(insert, at(900 - 60_000));
		db.execute(insert, at(-1000 - 60_000));

		assertEquals(loginAttemptsQueries.countRecent('10.0.0.1', '/auth/login', 1), 1);
		assertEquals(
			loginAttemptsQueries.countRecentByCategory('10.0.0.1', '/auth/login', 'typo', 1),
			1
		);
		assertEquals(loginAttemptsQueries.deleteExpired(1), 1);
	});

	test('history is deleted once it passes the retention period', async () => {
		db.execute(
			`INSERT INTO arr_instances (name, type, url, api_key) VALUES ('history', 'radarr', 'http://localhost:7878', 'key')`
		);
		const arrId = lastId();
		db.execute(
			`INSERT INTO notification_services (id, name, service_type, config, enabled_types)
			 VALUES ('service', 'Test', 'discord', '{}', '[]')`
		);

		const day = 24 * 60 * 60 * 1000;
		const { at } = await times();
		// One-day retention: one row just past the cutoff this second, one still inside it
		for (const timestamp of [at(-day), at(900 - day)]) {
			db.execute(
				`INSERT INTO notification_history (service_id, notification_type, title, message, status, sent_at)
				 VALUES ('service', 'test', 'Title', 'Message', 'success', ?)`,
				timestamp
			);
			db.execute(
				`INSERT INTO rename_runs (instance_id, started_at, completed_at, status, library_total,
					library_fetch_ms, after_ignore_tag, skipped_by_tag, files_needing_rename, files_renamed,
					folders_renamed, commands_triggered, commands_completed, commands_failed)
				 VALUES (?, ?, ?, 'success', 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)`,
				arrId,
				timestamp,
				timestamp
			);
			db.execute(
				`INSERT INTO upgrade_runs (instance_id, started_at, completed_at, status, cron, filter_mode,
					filter_name, library_total, library_fetch_ms, matched_count, after_cooldown, cooldown_hours,
					selection_method, selection_requested, selected_count, searches_triggered, successful, failed)
				 VALUES (?, ?, ?, 'success', '0 * * * *', 'round_robin', 'Filter', 0, 0, 0, 0, 0, 'random', 0, 0, 0, 0, 0)`,
				arrId,
				timestamp,
				timestamp
			);
		}

		assertEquals(notificationHistoryQueries.deleteOlderThan(1), 1);
		assertEquals(renameRunsQueries.deleteOlderThan(1), 1);
		assertEquals(upgradeRunsQueries.deleteOlderThan(1), 1);
	});
});
