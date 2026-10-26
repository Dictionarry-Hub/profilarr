/**
 * A database pull queues On Pull syncs only for the Arr sections that use the
 * pulled database. Quality Profiles counts when any selected profile comes
 * from it, Delay Profiles when its profile does, and Media Management when
 * naming, quality definitions or media settings do. Sections on another
 * trigger are never queued.
 */

import { assertEquals } from '@std/assert';
import type { SyncTrigger } from '$db/queries/arrSync.ts';

type Section = 'qualityProfiles' | 'delayProfiles' | 'mediaManagement';

Deno.test('on pull syncs only the sections that use the pulled database', async (t) => {
	// Point the app at a fresh folder before anything imports config
	const baseDir = await Deno.makeTempDir({ prefix: 'profilarr-on-pull-' });
	Deno.env.set('APP_BASE_PATH', baseDir);

	const { db } = await import('$db/db.ts');
	const { runMigrations } = await import('$db/migrations.ts');
	const { arrInstancesQueries } = await import('$db/queries/arrInstances.ts');
	const { arrSyncQueries } = await import('$db/queries/arrSync.ts');
	const { jobQueueQueries } = await import('$db/queries/jobQueue.ts');
	const { jobDispatcher } = await import('$jobs/dispatcher.ts');
	const { triggerSyncs } = await import('$sync/processor.ts');

	const A = 1;
	const B = 2;

	/** One instance with all three sections on one trigger. */
	function instance(
		name: string,
		trigger: SyncTrigger,
		dbs: { profiles: number[]; delay: number; naming: number; definitions: number; media: number }
	): number {
		const id = arrInstancesQueries.create({
			name,
			type: 'radarr',
			url: `http://${name}.local`,
			apiKey: 'test-api-key'
		});
		arrSyncQueries.saveQualityProfilesSync(
			id,
			dbs.profiles.map((databaseId) => ({
				databaseId,
				profileName: `Profile ${databaseId}`,
				qualityDefinitionsConfigName: null
			})),
			{ trigger, cron: null }
		);
		arrSyncQueries.saveDelayProfilesSync(id, {
			databaseId: dbs.delay,
			profileName: 'Delay',
			trigger,
			cron: null
		});
		arrSyncQueries.saveMediaManagementSync(id, {
			namingDatabaseId: dbs.naming,
			namingConfigName: 'Naming',
			qualityDefinitionsDatabaseId: dbs.definitions,
			qualityDefinitionsConfigName: 'Definitions',
			mediaSettingsDatabaseId: dbs.media,
			mediaSettingsConfigName: 'Media',
			trigger,
			cron: null
		});
		return id;
	}

	/** Pull, then read back the queued sync jobs and clear them. */
	async function pull(databaseId?: number): Promise<string[]> {
		await triggerSyncs({ event: 'on_pull', databaseId });
		jobDispatcher.stop();
		const jobs = jobQueueQueries
			.listByJobTypes([
				'arr.sync.qualityProfiles',
				'arr.sync.delayProfiles',
				'arr.sync.mediaManagement'
			])
			.map((job) => `${job.jobType}:${job.payload.instanceId}`)
			.sort();
		db.execute(`DELETE FROM job_queue`);
		return jobs;
	}

	const job = (section: Section, instanceId: number) => `arr.sync.${section}:${instanceId}`;

	try {
		await db.initialize();
		await runMigrations();

		for (const [id, name] of [
			[A, 'Database A'],
			[B, 'Database B']
		] as const) {
			db.execute(
				`INSERT INTO database_instances (id, uuid, name, repository_url, local_path, enabled) VALUES (?, ?, ?, ?, ?, 1)`,
				id,
				`uuid-${id}`,
				name,
				`https://example.invalid/${id}.git`,
				`/tmp/db-${id}`
			);
		}

		const onA = instance('on-a', 'on_pull', {
			profiles: [A],
			delay: A,
			naming: A,
			definitions: A,
			media: A
		});
		const onB = instance('on-b', 'on_pull', {
			profiles: [B],
			delay: B,
			naming: B,
			definitions: B,
			media: B
		});
		const mixed = instance('mixed', 'on_pull', {
			profiles: [B],
			delay: A,
			naming: B,
			definitions: A,
			media: B
		});
		const twoDatabases = instance('two-databases', 'on_pull', {
			profiles: [B, A],
			delay: B,
			naming: B,
			definitions: B,
			media: A
		});
		instance('manual-a', 'manual', {
			profiles: [A],
			delay: A,
			naming: A,
			definitions: A,
			media: A
		});

		await t.step('a pull of A queues only the sections that use A', async () => {
			assertEquals(
				await pull(A),
				[
					job('delayProfiles', mixed),
					job('delayProfiles', onA),
					job('mediaManagement', mixed),
					job('mediaManagement', onA),
					job('mediaManagement', twoDatabases),
					job('qualityProfiles', onA),
					job('qualityProfiles', twoDatabases)
				].sort()
			);
		});

		await t.step('only the queued sections are marked pending', () => {
			const status = arrSyncQueries.getSyncConfigStatus(mixed);
			assertEquals(status.qualityProfiles.syncStatus, 'idle');
			assertEquals(status.delayProfiles.syncStatus, 'pending');
			assertEquals(status.mediaManagement.syncStatus, 'pending');
			assertEquals(arrSyncQueries.getSyncConfigStatus(onB).qualityProfiles.syncStatus, 'idle');
		});

		await t.step('a trigger without a database queues every on pull section', async () => {
			const jobs = await pull();
			assertEquals(jobs.length, 12);
			assertEquals(jobs.includes(job('qualityProfiles', onB)), true);
			assertEquals(jobs.includes(job('qualityProfiles', mixed)), true);
		});
	} finally {
		jobDispatcher.stop();
		db.close();
		await Deno.remove(baseDir, { recursive: true });
	}
});
