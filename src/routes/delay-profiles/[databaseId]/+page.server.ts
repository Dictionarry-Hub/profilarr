import { error } from '@sveltejs/kit';
import type { ServerLoad } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as delayProfileQueries from '$pcd/entities/delayProfiles/index.ts';
import { setLastDatabase } from '$utils/redirect/lastDatabase.ts';

export const load: ServerLoad = async ({ params, cookies }) => {
	const { databaseId } = params;

	// Validate params exist
	if (!databaseId) {
		throw error(400, 'Missing database ID');
	}

	// Get all databases for tabs
	const databases = pcdManager.getAllPublic();

	// Parse and validate the database ID
	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	// Get the current database instance
	const currentDatabase = databases.find((db) => db.id === currentDatabaseId);

	if (!currentDatabase) {
		throw error(404, 'Database not found');
	}

	setLastDatabase(cookies, 'last_db_dp', currentDatabaseId);

	// Get the cache for the database
	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	// Load delay profiles for the current database
	const delayProfiles = await delayProfileQueries.list(cache);

	return {
		databases,
		currentDatabase,
		delayProfiles,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};
