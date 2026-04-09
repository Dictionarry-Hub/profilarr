/**
 * GET /api/v1/status
 *
 * Dashboard-friendly system summary. Returns version, uptime, linked databases
 * with entity counts, arr instances with sync status, job queue state, and
 * backup status.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { db } from '$db/db.ts';
import { appInfoQueries } from '$db/queries/appInfo.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { backupSettingsQueries } from '$db/queries/backupSettings.ts';
import { getCache } from '$pcd/database/registry.ts';
import { config } from '$config';

type StatusResponse = components['schemas']['StatusResponse'];

const startupTime = Date.now();

export const GET: RequestHandler = async () => {
	const response: StatusResponse = {
		version: appInfoQueries.getVersion(),
		uptime: Math.floor((Date.now() - startupTime) / 1000),
		databases: buildDatabases(),
		arrs: buildArrs(),
		jobs: buildJobs(),
		backups: await buildBackups()
	};

	return json(response);
};

function buildDatabases(): StatusResponse['databases'] {
	const instances = databaseInstancesQueries.getAll();

	return instances.map((inst) => {
		const cache = getCache(inst.id);
		const ready = cache?.isBuilt() ?? false;

		const counts = ready
			? {
					customFormats:
						cache!.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM custom_formats')?.c ?? 0,
					qualityProfiles:
						cache!.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM quality_profiles')?.c ?? 0,
					regularExpressions:
						cache!.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM regular_expressions')?.c ?? 0,
					delayProfiles:
						cache!.queryOne<{ c: number }>('SELECT COUNT(*) as c FROM delay_profiles')?.c ?? 0
				}
			: { customFormats: 0, qualityProfiles: 0, regularExpressions: 0, delayProfiles: 0 };

		return {
			id: inst.id,
			name: inst.name,
			enabled: inst.enabled === 1,
			lastSyncedAt: inst.last_synced_at,
			syncStrategy: (inst.sync_strategy === 0 ? 'manual' : 'auto') as 'manual' | 'auto',
			counts
		};
	});
}

function buildArrs(): StatusResponse['arrs'] {
	const instances = arrInstancesQueries.getAll();

	return instances.map((inst) => {
		const qpSync = arrSyncQueries.getQualityProfilesSync(inst.id);
		const qpStatus = arrSyncQueries.getSectionSyncStatus(inst.id, 'qualityProfiles');

		const dpSync = arrSyncQueries.getDelayProfilesSync(inst.id);
		const dpStatus = arrSyncQueries.getSectionSyncStatus(inst.id, 'delayProfiles');

		const mmSync = arrSyncQueries.getMediaManagementSync(inst.id);
		const mmStatus = arrSyncQueries.getSectionSyncStatus(inst.id, 'mediaManagement');

		const mmConfigured =
			mmSync.namingDatabaseId !== null ||
			mmSync.qualityDefinitionsDatabaseId !== null ||
			mmSync.mediaSettingsDatabaseId !== null;

		return {
			id: inst.id,
			name: inst.name,
			type: inst.type as 'radarr' | 'sonarr',
			enabled: inst.enabled === 1,
			sync: {
				qualityProfiles: {
					count: qpSync.selections.length,
					status: qpStatus?.sync_status ?? 'idle',
					lastSyncedAt: qpStatus?.last_synced_at ?? null
				},
				delayProfiles: {
					configured: dpSync.databaseId !== null,
					status: dpStatus?.sync_status ?? 'idle',
					lastSyncedAt: dpStatus?.last_synced_at ?? null
				},
				mediaManagement: {
					configured: mmConfigured,
					status: mmStatus?.sync_status ?? 'idle',
					lastSyncedAt: mmStatus?.last_synced_at ?? null
				}
			},
			drift: null
		};
	});
}

function buildJobs(): StatusResponse['jobs'] {
	const active =
		db.queryFirst<{ c: number }>("SELECT COUNT(*) as c FROM job_queue WHERE status = 'running'")
			?.c ?? 0;
	const queued =
		db.queryFirst<{ c: number }>("SELECT COUNT(*) as c FROM job_queue WHERE status = 'queued'")
			?.c ?? 0;
	const nextRun = db.queryFirst<{ run_at: string }>(
		"SELECT run_at FROM job_queue WHERE status = 'queued' ORDER BY run_at ASC LIMIT 1"
	);

	return {
		active,
		queued,
		nextRunAt: nextRun?.run_at ?? null
	};
}

async function buildBackups(): Promise<StatusResponse['backups']> {
	const settings = backupSettingsQueries.get();
	const enabled = settings?.enabled === 1;

	let lastBackupAt: string | null = null;

	if (enabled) {
		const backupPath = config.paths.backups;
		let latestTime: number | null = null;

		try {
			for await (const entry of Deno.readDir(backupPath)) {
				if (entry.isFile && entry.name.startsWith('backup-') && entry.name.endsWith('.tar.gz')) {
					const stat = await Deno.stat(`${backupPath}/${entry.name}`);
					if (!latestTime || stat.mtime!.getTime() > latestTime) {
						latestTime = stat.mtime!.getTime();
						lastBackupAt = stat.mtime!.toISOString();
					}
				}
			}
		} catch {
			// Backup directory might not exist yet
		}
	}

	return { enabled, lastBackupAt };
}
