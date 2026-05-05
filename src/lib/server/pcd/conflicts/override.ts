import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { compile, getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import { logger } from '$logger/logger.ts';
import { AUTO_ALIGN_ENTITIES } from '$pcd/entities/registry.ts';
import {
	dropOp,
	parseJson,
	parseOpIdFromFilepath,
	type StoredDesiredState,
	type StoredOpMetadata,
	supersedeOp
} from './overrideUtils.ts';
import {
	overrideCreate as cfOverrideCreate,
	overrideUpdate as cfOverrideUpdate
} from '$pcd/entities/customFormats/override/index.ts';
import {
	overrideCreate as qpOverrideCreate,
	overrideUpdate as qpOverrideUpdate
} from '$pcd/entities/qualityProfiles/override/index.ts';
import {
	overrideCreate as reOverrideCreate,
	overrideUpdate as reOverrideUpdate
} from '$pcd/entities/regularExpressions/override.ts';
import {
	overrideCreate as dpOverrideCreate,
	overrideDelete as dpOverrideDelete,
	overrideUpdate as dpOverrideUpdate
} from '$pcd/entities/delayProfiles/override.ts';
import {
	overrideCreate as namingOverrideCreate,
	overrideUpdate as namingOverrideUpdate
} from '$pcd/entities/mediaManagement/naming/override.ts';
import {
	overrideCreate as msOverrideCreate,
	overrideUpdate as msOverrideUpdate
} from '$pcd/entities/mediaManagement/media-settings/override.ts';
import {
	overrideCreate as qdOverrideCreate,
	overrideUpdate as qdOverrideUpdate
} from '$pcd/entities/mediaManagement/quality-definitions/override.ts';

type OverrideConflictResult = {
	success: boolean;
	error?: string;
};

async function overrideEntity(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null,
	operation: string
): Promise<WriteResult> {
	const entity = metadata?.entity;

	switch (entity) {
		case 'custom_format':
			return operation === 'create'
				? cfOverrideCreate(databaseId, metadata, desiredState)
				: cfOverrideUpdate(databaseId, metadata, desiredState);
		case 'quality_profile':
			return operation === 'create'
				? qpOverrideCreate(databaseId, metadata, desiredState)
				: qpOverrideUpdate(databaseId, metadata, desiredState);
		case 'regular_expression':
			return operation === 'create'
				? reOverrideCreate(databaseId, metadata, desiredState)
				: reOverrideUpdate(databaseId, metadata, desiredState);
		case 'delay_profile':
			if (operation === 'create') return dpOverrideCreate(databaseId, metadata, desiredState);
			if (operation === 'delete') return dpOverrideDelete(databaseId, metadata, desiredState);
			return dpOverrideUpdate(databaseId, metadata, desiredState);
		case 'radarr_naming':
		case 'sonarr_naming':
			return operation === 'create'
				? namingOverrideCreate(databaseId, metadata, desiredState)
				: namingOverrideUpdate(databaseId, metadata, desiredState);
		case 'radarr_media_settings':
		case 'sonarr_media_settings':
			return operation === 'create'
				? msOverrideCreate(databaseId, metadata, desiredState)
				: msOverrideUpdate(databaseId, metadata, desiredState);
		case 'radarr_quality_definitions':
		case 'sonarr_quality_definitions':
			return operation === 'create'
				? qdOverrideCreate(databaseId, metadata, desiredState)
				: qdOverrideUpdate(databaseId, metadata, desiredState);
		default:
			return {
				success: false,
				error: `Override not yet implemented for entity: ${entity}`
			};
	}
}

function canOverrideDelete(entity?: string): boolean {
	return entity === 'delay_profile';
}

function deleteTargetExists(databaseId: number, metadata: StoredOpMetadata | null): boolean | null {
	const entityName = metadata?.entity;
	if (!entityName) return null;

	const entity = AUTO_ALIGN_ENTITIES.get(entityName);
	if (!entity) return null;

	const cache = getCache(databaseId);
	if (!cache) return null;

	const typedMetadata = metadata as StoredOpMetadata & { stableKey?: { value?: string } };
	const candidates = [
		metadata.stable_key?.value,
		typedMetadata.stableKey?.value,
		metadata.name
	].filter((value): value is string => typeof value === 'string' && value.length > 0);

	for (const candidate of candidates) {
		// nosemgrep: profilarr.sql.template-literal-interpolation - table/column from hardcoded registry
		const row = cache.queryOne<{ found: number }>(
			`SELECT 1 AS found FROM ${entity.table} WHERE ${entity.keyColumn} = ? LIMIT 1`,
			candidate
		);
		if (row) return true;
	}

	return false;
}

export async function overrideConflict(input: {
	databaseId: number;
	opId: number;
}): Promise<OverrideConflictResult> {
	const { databaseId, opId } = input;

	const op = pcdOpsQueries.getById(opId);
	if (!op || op.database_id !== databaseId) {
		return { success: false, error: 'Conflict operation not found' };
	}

	if (op.origin !== 'user' || op.state !== 'published') {
		return {
			success: false,
			error: 'Only published user operations can be overridden'
		};
	}

	const metadata = parseJson<StoredOpMetadata>(op.metadata);
	const desiredState = parseJson<StoredDesiredState>(op.desired_state);
	const operation = metadata?.operation ?? 'update';

	const instance = databaseInstancesQueries.getById(databaseId);

	if (operation === 'delete') {
		const targetExists = deleteTargetExists(databaseId, metadata);
		const canRegenerate = targetExists === true && canOverrideDelete(metadata?.entity);

		const dropped = await dropOp(databaseId, opId);
		if (!dropped) {
			return {
				success: false,
				error: 'Failed to drop conflicting delete operation'
			};
		}
		if (instance?.enabled) {
			await compile(instance.local_path, databaseId);
		}

		if (canRegenerate) {
			const result: WriteResult = await overrideEntity(
				databaseId,
				metadata,
				desiredState,
				operation
			);
			if (!result.success) {
				return {
					success: false,
					error: result.error || 'Failed to override conflict'
				};
			}

			const newOpId = parseOpIdFromFilepath(result.filepath ?? null);
			if (newOpId) {
				await supersedeOp(databaseId, opId, newOpId);
			}

			await logger.info('Overrode conflict', {
				source: 'PCDConflicts',
				meta: { databaseId, opId, newOpId }
			});

			return { success: true };
		}

		if (targetExists === true) {
			await logger.warn('Override delete fell back to drop; re-deletion not implemented', {
				source: 'PCDConflicts',
				meta: { databaseId, opId, entity: metadata?.entity }
			});
		}

		await logger.info('Overrode conflict', {
			source: 'PCDConflicts',
			meta: { databaseId, opId }
		});

		return { success: true };
	}

	// Drop old op and recompile to get a clean cache before generating
	// the replacement.  Without this the override handler reads dirty
	// partial-execution state (e.g. guard-failed DELETEs but successful
	// INSERTs) and produces an op whose guards won't match the clean
	// upstream state after recompilation.
	const dropped = await dropOp(databaseId, opId);
	if (!dropped) {
		return {
			success: false,
			error: 'Failed to drop conflicting operation for override'
		};
	}
	if (instance?.enabled) {
		await compile(instance.local_path, databaseId);
	}

	const result: WriteResult = await overrideEntity(databaseId, metadata, desiredState, operation);
	if (!result.success) {
		return {
			success: false,
			error: result.error || 'Failed to override conflict'
		};
	}

	// Link old → new for audit trail; writeOperation already recompiled
	const newOpId = parseOpIdFromFilepath(result.filepath ?? null);
	if (newOpId) {
		await supersedeOp(databaseId, opId, newOpId);
	}

	await logger.info('Overrode conflict', {
		source: 'PCDConflicts',
		meta: { databaseId, opId, newOpId }
	});

	return { success: true };
}
