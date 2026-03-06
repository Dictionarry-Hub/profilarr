import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import {
	syncQualityProfile,
	syncCustomFormat,
	syncRegularExpression,
	syncDelayProfile,
	syncNaming,
	syncQualityDefinitions,
	syncMediaSettings
} from '$lib/server/sync/entitySync.ts';
import { logger } from '$logger/logger.ts';

type SyncEntityRequest = components['schemas']['SyncEntityRequest'];
type EntityType = NonNullable<SyncEntityRequest['entityType']>;

const COOLDOWN_MS = 5_000;

type SyncSection = 'qualityProfiles' | 'delayProfiles' | 'mediaManagement';

const ENTITY_TYPE_TO_SECTION: Record<EntityType, SyncSection> = {
	qualityProfile: 'qualityProfiles',
	customFormat: 'qualityProfiles',
	regularExpression: 'qualityProfiles',
	delayProfile: 'delayProfiles',
	naming: 'mediaManagement',
	qualityDefinitions: 'mediaManagement',
	mediaSettings: 'mediaManagement'
};

/**
 * POST /api/v1/arr/sync-entity
 *
 * Targeted entity sync — pushes a single entity to an arr instance.
 * Runs inline (no job queue) and returns when done.
 *
 * Body: { instanceId, databaseId, entityName, entityType }
 * Returns: { success: true } or { error: '...' }
 */
export const POST: RequestHandler = async ({ request }) => {
	const body = (await request.json()) as SyncEntityRequest;
	const { instanceId, databaseId, entityName, entityType } = body;

	if (!instanceId || typeof instanceId !== 'number') {
		return json({ error: 'instanceId is required' }, { status: 400 });
	}

	if (!entityType || !ENTITY_TYPE_TO_SECTION[entityType]) {
		return json(
			{ error: `entityType must be one of: ${Object.keys(ENTITY_TYPE_TO_SECTION).join(', ')}` },
			{ status: 400 }
		);
	}

	if (!databaseId || typeof databaseId !== 'number') {
		return json({ error: 'databaseId is required' }, { status: 400 });
	}

	if (!entityName || typeof entityName !== 'string') {
		return json({ error: 'entityName is required' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}

	const section = ENTITY_TYPE_TO_SECTION[entityType];

	// Check cooldown and in-progress status
	const status = arrSyncQueries.getSectionSyncStatus(instanceId, section);
	if (status) {
		if (status.sync_status === 'pending' || status.sync_status === 'in_progress') {
			await logger.debug(`Entity sync blocked: ${section} already ${status.sync_status}`, {
				source: 'EntitySync:Cooldown',
				meta: { instanceId, section, syncStatus: status.sync_status }
			});
			return json({ error: 'Sync already in progress' }, { status: 409 });
		}

		if (status.last_synced_at) {
			const elapsed = Date.now() - new Date(status.last_synced_at).getTime();
			if (elapsed < COOLDOWN_MS) {
				const retryAfter = Math.ceil((COOLDOWN_MS - elapsed) / 1000);
				await logger.debug(`Entity sync cooldown: ${retryAfter}s remaining for ${section}`, {
					source: 'EntitySync:Cooldown',
					meta: { instanceId, section, retryAfter, lastSyncedAt: status.last_synced_at }
				});
				return json({ error: 'Cooldown active', retryAfter }, { status: 409 });
			}
		}
	}

	try {
		let result: { success: boolean; error?: string };

		switch (entityType) {
			case 'qualityProfile':
				result = await syncQualityProfile(instanceId, databaseId, entityName);
				break;
			case 'customFormat':
				result = await syncCustomFormat(instanceId, databaseId, entityName);
				break;
			case 'regularExpression':
				result = await syncRegularExpression(instanceId, databaseId, entityName);
				break;
			case 'delayProfile':
				result = await syncDelayProfile(instanceId, databaseId, entityName);
				break;
			case 'naming':
				result = await syncNaming(instanceId, databaseId, entityName);
				break;
			case 'qualityDefinitions':
				result = await syncQualityDefinitions(instanceId, databaseId, entityName);
				break;
			case 'mediaSettings':
				result = await syncMediaSettings(instanceId, databaseId, entityName);
				break;
			default:
				return json({ error: `Unknown entity type: ${entityType}` }, { status: 400 });
		}

		if (result.success) {
			return json({ success: true });
		} else {
			return json({ error: result.error ?? 'Sync failed' }, { status: 500 });
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Sync failed';
		return json({ error: message }, { status: 500 });
	}
};
