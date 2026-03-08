import { error, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import { tmdbSettingsQueries } from '$db/queries/tmdbSettings.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import * as entityTestQueries from '$pcd/entities/qualityProfiles/entityTests/index.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';
import { isParserHealthy } from '$lib/server/utils/arr/parser/index.ts';
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

	setLastDatabase(cookies, 'last_db_et', currentDatabaseId);

	// Get the cache for the database
	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	const testEntities = await entityTestQueries.list(cache);
	const qualityProfiles = await qualityProfileQueries.select(cache);
	const cfScoresData = await qualityProfileQueries.allCfScores(cache);

	// Check if TMDB API key is configured
	const tmdbSettings = tmdbSettingsQueries.get();
	const tmdbConfigured = !!tmdbSettings?.api_key;

	// Check parser availability
	const parserAvailable = await isParserHealthy();

	// Get enabled Arr instances for release import
	const arrInstances = arrInstancesQueries.getEnabled().map((instance) => ({
		id: instance.id,
		name: instance.name,
		type: instance.type as 'radarr' | 'sonarr'
	}));

	return {
		databases,
		currentDatabase,
		tmdbConfigured,
		parserAvailable,
		testEntities,
		qualityProfiles,
		cfScoresData,
		arrInstances,
		canWriteToBase: canWriteToBase(currentDatabaseId)
	};
};

export const actions: Actions = {
	addEntities: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const entitiesJson = formData.get('entities') as string;
		const layer = (formData.get('layer') as 'user' | 'base') || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer for this database' });
		}

		let entities: Array<{
			type: 'movie' | 'series';
			tmdbId: number;
			title: string;
			year: number | null;
			posterPath: string | null;
		}>;

		try {
			entities = JSON.parse(entitiesJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid entities format' });
		}

		if (entities.length === 0) {
			return fail(400, { error: 'No entities to add' });
		}

		const result = await entityTestQueries.create({
			databaseId: currentDatabaseId,
			cache,
			layer,
			inputs: entities
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to add entities' });
		}

		return {
			success: true,
			added: result.added,
			skipped: result.skipped
		};
	},

	deleteEntity: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const entityType = formData.get('entityType') as 'movie' | 'series';
		const entityTmdbId = parseInt(formData.get('entityTmdbId') as string, 10);
		const entityTitle = formData.get('entityTitle') as string;
		const layer = (formData.get('layer') as 'user' | 'base') || 'user';

		if (!entityType || !['movie', 'series'].includes(entityType)) {
			return fail(400, { error: 'Invalid entity type' });
		}

		if (isNaN(entityTmdbId)) {
			return fail(400, { error: 'Invalid entity TMDB ID' });
		}

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer for this database' });
		}

		const result = await entityTestQueries.remove({
			databaseId: currentDatabaseId,
			cache,
			layer,
			entityType,
			entityTmdbId,
			entityTitle: entityTitle || 'Unknown'
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete entity' });
		}

		return { success: true };
	},

	createRelease: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const releaseJson = formData.get('release') as string;
		const layer = (formData.get('layer') as 'user' | 'base') || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer for this database' });
		}

		let release: {
			entityType: 'movie' | 'series';
			entityTmdbId: number;
			title: string;
			size_bytes: number | null;
			languages: string[];
			indexers: string[];
			flags: string[];
		};

		try {
			release = JSON.parse(releaseJson || '{}');
		} catch {
			return fail(400, { error: 'Invalid release format' });
		}

		if (!release.title) {
			return fail(400, { error: 'Release title is required' });
		}

		const result = await entityTestQueries.createRelease({
			databaseId: currentDatabaseId,
			cache,
			layer,
			input: release
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to create release' });
		}

		return { success: true };
	},

	updateRelease: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const releaseJson = formData.get('release') as string;
		const layer = (formData.get('layer') as 'user' | 'base') || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer for this database' });
		}

		let release: {
			id: number;
			title: string;
			size_bytes: number | null;
			languages: string[];
			indexers: string[];
			flags: string[];
		};

		try {
			release = JSON.parse(releaseJson || '{}');
		} catch {
			return fail(400, { error: 'Invalid release format' });
		}

		if (!release.id) {
			return fail(400, { error: 'Release ID is required' });
		}

		if (!release.title) {
			return fail(400, { error: 'Release title is required' });
		}

		const currentRelease = await entityTestQueries.getReleaseById(cache, release.id);
		if (!currentRelease) {
			return fail(404, { error: 'Release not found' });
		}

		const result = await entityTestQueries.updateRelease({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current: currentRelease,
			input: {
				title: release.title,
				size_bytes: release.size_bytes,
				languages: release.languages,
				indexers: release.indexers,
				flags: release.flags
			}
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update release' });
		}

		return { success: true };
	},

	deleteRelease: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const releaseId = parseInt(formData.get('releaseId') as string, 10);
		const layer = (formData.get('layer') as 'user' | 'base') || 'user';

		if (isNaN(releaseId)) {
			return fail(400, { error: 'Invalid release ID' });
		}

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer for this database' });
		}

		const currentRelease = await entityTestQueries.getReleaseById(cache, releaseId);
		if (!currentRelease) {
			return fail(404, { error: 'Release not found' });
		}

		const result = await entityTestQueries.deleteRelease({
			databaseId: currentDatabaseId,
			cache,
			layer,
			current: currentRelease
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to delete release' });
		}

		return { success: true };
	},

	importReleases: async ({ request, params }) => {
		const { databaseId } = params;

		if (!databaseId) {
			return fail(400, { error: 'Missing database ID' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}
		if (!canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Entity tests are read-only for this database' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();
		const releasesJson = formData.get('releases') as string;
		const layer = (formData.get('layer') as 'user' | 'base') || 'user';

		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer for this database' });
		}

		let releases: Array<{
			entityType: 'movie' | 'series';
			entityTmdbId: number;
			title: string;
			size_bytes: number | null;
			languages: string[];
			indexers: string[];
			flags: string[];
		}>;

		try {
			releases = JSON.parse(releasesJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid releases format' });
		}

		if (releases.length === 0) {
			return fail(400, { error: 'No releases to import' });
		}

		const result = await entityTestQueries.createReleases({
			databaseId: currentDatabaseId,
			cache,
			layer,
			inputs: releases
		});

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to import releases' });
		}

		return {
			success: true,
			added: result.added,
			skipped: result.skipped
		};
	}
};
