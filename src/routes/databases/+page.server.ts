import { fail } from '@sveltejs/kit';
import { redirect } from '$utils/redirect/redirect.ts';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import type { DatabaseInstancePublic } from '$db/queries/databaseInstances.ts';
import { db } from '$db/db.ts';
import { logger } from '$logger/logger.ts';

export interface DatabaseInstanceSummary extends DatabaseInstancePublic {
	qualityProfileCount: number;
	customFormatCount: number;
	delayProfileCount: number;
	linkedArrCount: number;
}

export const load: ServerLoad = () => {
	const databases = pcdManager.getAllPublic();

	const summaries: DatabaseInstanceSummary[] = databases.map((database) => {
		const cache = pcdManager.getCache(database.id);

		let qualityProfileCount = 0;
		let customFormatCount = 0;
		let delayProfileCount = 0;

		if (cache) {
			qualityProfileCount =
				cache.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM quality_profiles')
					?.count ?? 0;
			customFormatCount =
				cache.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM custom_formats')?.count ??
				0;
			delayProfileCount =
				cache.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM delay_profiles')?.count ??
				0;
		}

		const linkedArrCount =
			db.queryFirst<{ count: number }>(
				`SELECT COUNT(DISTINCT instance_id) as count FROM (
				SELECT instance_id FROM arr_sync_quality_profiles WHERE database_id = ?
				UNION
				SELECT instance_id FROM arr_sync_delay_profiles_config WHERE database_id = ?
				UNION
				SELECT instance_id FROM arr_sync_media_management
					WHERE naming_database_id = ?
					OR quality_definitions_database_id = ?
					OR media_settings_database_id = ?
			)`,
				database.id,
				database.id,
				database.id,
				database.id,
				database.id
			)?.count ?? 0;

		return {
			...database,
			qualityProfileCount,
			customFormatCount,
			delayProfileCount,
			linkedArrCount
		};
	});

	return { databases: summaries };
};

export const actions = {
	delete: async ({ request }) => {
		const formData = await request.formData();
		const id = parseInt(formData.get('id')?.toString() || '0', 10);

		if (!id) {
			await logger.warn('Attempted to unlink database without ID', {
				source: 'databases'
			});

			return fail(400, {
				error: 'Database ID is required'
			});
		}

		try {
			await pcdManager.unlink(id);

			await logger.info(`Unlinked database: ${id}`, {
				source: 'databases',
				meta: { id }
			});

			redirect(303, '/databases');
		} catch (error) {
			// Re-throw redirect errors (they're not actual errors)
			if (error && typeof error === 'object' && 'status' in error && 'location' in error) {
				throw error;
			}

			await logger.error('Failed to unlink database', {
				source: 'databases',
				meta: { error: error instanceof Error ? error.message : String(error) }
			});

			return fail(500, {
				error: error instanceof Error ? error.message : 'Failed to unlink database'
			});
		}
	}
} satisfies Actions;
