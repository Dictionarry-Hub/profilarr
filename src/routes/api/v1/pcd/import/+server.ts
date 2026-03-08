import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { PCDCache } from '$pcd/database/cache.ts';
import { ENTITY_TYPES } from '$shared/pcd/portable.ts';
import type {
	EntityType,
	PortableDelayProfile,
	PortableRegularExpression,
	PortableCustomFormat,
	PortableQualityProfile,
	PortableRadarrNaming,
	PortableSonarrNaming,
	PortableMediaSettings,
	PortableQualityDefinitions
} from '$shared/pcd/portable.ts';
import * as deserialize from '$pcd/entities/deserialize.ts';
import { validatePortableData } from '$pcd/entities/validate.ts';

const VALID_ENTITY_TYPES: ReadonlySet<string> = new Set(ENTITY_TYPES);

const VALID_LAYERS: Set<string> = new Set(['user', 'base']);

export const POST: RequestHandler = async ({ request }) => {
	let body: Record<string, unknown>;
	try {
		body = await request.json();
	} catch {
		return json({ error: 'Invalid JSON body' }, { status: 400 });
	}

	const { databaseId, layer, entityType, data } = body;

	if (databaseId === undefined || !layer || !entityType || !data) {
		return json(
			{ error: 'Missing required fields: databaseId, layer, entityType, data' },
			{ status: 400 }
		);
	}

	if (typeof databaseId !== 'number' || !Number.isInteger(databaseId)) {
		return json({ error: 'Invalid databaseId' }, { status: 400 });
	}

	if (!VALID_LAYERS.has(layer as string)) {
		return json({ error: `Invalid layer: ${layer}` }, { status: 400 });
	}

	if (!VALID_ENTITY_TYPES.has(entityType as string)) {
		return json({ error: `Invalid entityType: ${entityType}` }, { status: 400 });
	}

	if (layer === 'base' && !canWriteToBase(databaseId as number)) {
		return json({ error: 'Cannot write to base layer' }, { status: 403 });
	}

	const cache = pcdManager.getCache(databaseId as number);
	if (!cache) {
		return json({ error: 'Database cache not available' }, { status: 500 });
	}

	const validationError = validatePortableData(
		entityType as EntityType,
		data as Record<string, unknown>
	);
	if (validationError) {
		return json({ error: validationError }, { status: 400 });
	}

	try {
		await deserializeEntity({
			databaseId: databaseId as number,
			cache,
			layer: layer as OperationLayer,
			entityType: entityType as EntityType,
			data: data as Record<string, unknown>
		});
		return json({ success: true });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Import failed';
		return json({ error: message }, { status: 400 });
	}
};

interface DeserializeArgs {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	entityType: EntityType;
	data: Record<string, unknown>;
}

async function deserializeEntity({ databaseId, cache, layer, entityType, data }: DeserializeArgs) {
	const opts = { databaseId, cache, layer };

	switch (entityType) {
		case 'delay_profile':
			return deserialize.deserializeDelayProfile({
				...opts,
				portable: data as unknown as PortableDelayProfile
			});
		case 'regular_expression':
			return deserialize.deserializeRegularExpression({
				...opts,
				portable: data as unknown as PortableRegularExpression
			});
		case 'custom_format':
			return deserialize.deserializeCustomFormat({
				...opts,
				portable: data as unknown as PortableCustomFormat
			});
		case 'quality_profile':
			return deserialize.deserializeQualityProfile({
				...opts,
				portable: data as unknown as PortableQualityProfile
			});
		case 'radarr_naming':
			return deserialize.deserializeRadarrNaming({
				...opts,
				portable: data as unknown as PortableRadarrNaming
			});
		case 'sonarr_naming':
			return deserialize.deserializeSonarrNaming({
				...opts,
				portable: data as unknown as PortableSonarrNaming
			});
		case 'radarr_media_settings':
			return deserialize.deserializeRadarrMediaSettings({
				...opts,
				portable: data as unknown as PortableMediaSettings
			});
		case 'sonarr_media_settings':
			return deserialize.deserializeSonarrMediaSettings({
				...opts,
				portable: data as unknown as PortableMediaSettings
			});
		case 'radarr_quality_definitions':
			return deserialize.deserializeRadarrQualityDefinitions({
				...opts,
				portable: data as unknown as PortableQualityDefinitions
			});
		case 'sonarr_quality_definitions':
			return deserialize.deserializeSonarrQualityDefinitions({
				...opts,
				portable: data as unknown as PortableQualityDefinitions
			});
	}
}
