/**
 * PCD Operation Writer (DB-first)
 * Writes operations to pcd_ops instead of filesystem layers.
 */

import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { pcdOpsQueries } from '$db/queries/pcdOps.ts';
import { pcdOpHistoryQueries } from '$db/queries/pcdOpHistory.ts';
import type { PcdOpOrigin } from '$db/queries/pcdOps.ts';
import { logger } from '$logger/logger.ts';
import { compiledQueryToSql } from '../utils/sql.ts';
import { compile } from '../database/compiler.ts';
import { getCache } from '../database/registry.ts';
import type { OperationMetadata, OperationType, WriteOptions, WriteResult } from '../core/types.ts';
import { uuid } from '$shared/utils/uuid.ts';

function buildMetadataJson(metadata?: OperationMetadata): string | null {
	if (!metadata) return null;
	const payload: Record<string, unknown> = {
		operation: metadata.operation,
		entity: metadata.entity,
		name: metadata.name
	};
	if (metadata.previousName) {
		payload.previousName = metadata.previousName;
	}
	if (metadata.summary) {
		payload.summary = metadata.summary;
	}
	if (metadata.title) {
		payload.title = metadata.title;
	}
	if (metadata.changedFields && metadata.changedFields.length > 0) {
		payload.changed_fields = metadata.changedFields;
	}
	if (metadata.stableKey) {
		payload.stable_key = metadata.stableKey;
	}
	if (metadata.groupId) {
		payload.group_id = metadata.groupId;
	}
	if (metadata.generated) {
		payload.generated = true;
	}
	if (metadata.dependsOn && metadata.dependsOn.length > 0) {
		payload.depends_on = metadata.dependsOn;
	}
	return JSON.stringify(payload);
}

function serializeDesiredState(desiredState?: Record<string, unknown> | null): string | null {
	if (!desiredState) return null;
	return JSON.stringify(desiredState);
}

async function hashContent(sql: string, metadataJson: string | null): Promise<string> {
	const payload = `${sql}\n${metadataJson ?? ''}`;
	const data = new TextEncoder().encode(payload);
	const hashBuffer = await crypto.subtle.digest('SHA-256', data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function cancelOutCreate(
	databaseId: number,
	origin: PcdOpOrigin,
	metadata: OperationMetadata
): Promise<boolean> {
	if (metadata.operation !== 'delete') {
		return false;
	}

	const candidates = pcdOpsQueries.listByDatabaseAndOrigin(databaseId, origin, {
		source: 'local',
		states: ['published', 'draft']
	});

	type ParsedMetadata = {
		operation?: string;
		entity?: string;
		name?: string;
		stable_key?: { key?: string; value?: string };
	};

	function hasDependentOps(
		createdOpId: number,
		createdMeta: ParsedMetadata,
		createdStableKey: { key?: string; value?: string } | undefined
	): boolean {
		for (const op of candidates) {
			if (op.id <= createdOpId) continue;
			if (!op.metadata) continue;

			let parsed: ParsedMetadata;
			try {
				parsed = JSON.parse(op.metadata) as ParsedMetadata;
			} catch {
				continue;
			}

			const opStableKey = parsed.stable_key;
			if (
				createdStableKey?.key &&
				opStableKey?.key === createdStableKey.key &&
				opStableKey?.value === createdStableKey.value
			) {
				return true;
			}

			if (
				createdMeta.entity &&
				createdMeta.name &&
				parsed.entity === createdMeta.entity &&
				parsed.name === createdMeta.name
			) {
				return true;
			}

			if (createdMeta.entity === 'test_entity' && createdStableKey?.value) {
				const [entityType, entityTmdbIdRaw] = createdStableKey.value.split(':');
				const entityTmdbId = Number(entityTmdbIdRaw);
				if (!entityType || Number.isNaN(entityTmdbId)) {
					continue;
				}

				if (parsed.entity === 'test_release') {
					if (
						opStableKey?.value &&
						opStableKey.value.startsWith(`${entityType}:${entityTmdbId}:`)
					) {
						return true;
					}

					if (op.desired_state) {
						try {
							const desired = JSON.parse(op.desired_state) as {
								entity_type?: string;
								entity_tmdb_id?: number;
							};
							if (desired.entity_type === entityType && desired.entity_tmdb_id === entityTmdbId) {
								return true;
							}
						} catch {
							// ignore malformed desired_state
						}
					}
				}
			}
		}

		return false;
	}

	for (let i = candidates.length - 1; i >= 0; i--) {
		const candidate = candidates[i];
		if (!candidate.metadata) continue;

		let parsed: ParsedMetadata;
		try {
			parsed = JSON.parse(candidate.metadata) as ParsedMetadata;
		} catch {
			continue;
		}

		if (
			parsed.operation === 'create' &&
			parsed.entity === metadata.entity &&
			parsed.name === metadata.name
		) {
			if (hasDependentOps(candidate.id, parsed, parsed.stable_key)) {
				return false;
			}
			pcdOpsQueries.update(candidate.id, { state: 'dropped' });
			await logger.info('Cancelled out local create operation with delete', {
				source: 'PCDWriter',
				meta: { databaseId, opId: candidate.id, entity: metadata.entity, name: metadata.name }
			});
			return true;
		}
	}

	return false;
}

type ParsedMetadata = {
	operation?: string;
	entity?: string;
	name?: string;
	stable_key?: { key?: string; value?: string };
	changed_fields?: string[];
};

function parseMetadata(raw: string | null): ParsedMetadata | null {
	if (!raw) return null;
	try {
		return JSON.parse(raw) as ParsedMetadata;
	} catch {
		return null;
	}
}

function matchesStableKey(
	stableKey: OperationMetadata['stableKey'] | undefined,
	otherStableKey: ParsedMetadata['stable_key'] | undefined
): boolean | null {
	if (stableKey?.key && stableKey.value && otherStableKey?.key && otherStableKey.value) {
		return stableKey.key === otherStableKey.key && stableKey.value === otherStableKey.value;
	}
	return null;
}

function hasFieldCoverage(
	newFields: string[] | undefined,
	oldFields: string[] | undefined
): boolean {
	if (!newFields || newFields.length === 0) return false;
	if (!oldFields || oldFields.length === 0) return false;
	const newSet = new Set(newFields);
	return oldFields.every((field) => newSet.has(field));
}

async function supersedePriorUserOps(
	databaseId: number,
	newOpId: number,
	metadata: OperationMetadata
): Promise<void> {
	if (metadata.operation === 'create') {
		return;
	}

	const candidates = pcdOpsQueries.listByDatabaseAndOrigin(databaseId, 'user', {
		states: ['published']
	});

	const batchId = uuid();
	const superseded: number[] = [];

	for (const op of candidates) {
		if (op.id === newOpId || !op.metadata) continue;
		const parsed = parseMetadata(op.metadata);
		if (!parsed?.entity) continue;
		if (parsed.operation === 'create') continue;
		if (parsed.entity !== metadata.entity) continue;

		const stableKeyMatch = matchesStableKey(metadata.stableKey, parsed.stable_key);
		if (stableKeyMatch === false) {
			continue;
		}

		if (
			stableKeyMatch !== true &&
			(!parsed.name || !metadata.name || parsed.name !== metadata.name)
		) {
			continue;
		}

		if (metadata.operation === 'update') {
			if (parsed.operation !== 'update') {
				continue;
			}
			if (!hasFieldCoverage(metadata.changedFields, parsed.changed_fields)) {
				continue;
			}
		}

		const updated = pcdOpsQueries.update(op.id, {
			state: 'superseded',
			supersededByOpId: newOpId
		});
		if (!updated) continue;

		pcdOpHistoryQueries.create({
			opId: op.id,
			databaseId,
			batchId,
			status: 'superseded'
		});
		superseded.push(op.id);
	}

	if (superseded.length > 0) {
		await logger.info('Superseded prior user ops', {
			source: 'PCDWriter',
			meta: {
				databaseId,
				newOpId,
				entity: metadata.entity,
				name: metadata.name,
				supersededOpIds: superseded
			}
		});
	}
}

/**
 * Write operations to a PCD layer in the database
 *
 * For base layer: inserts a draft base op (origin=base, state=draft)
 * For user layer: inserts a published user op (origin=user, state=published)
 */
export async function writeOperation(options: WriteOptions): Promise<WriteResult> {
	const { databaseId, layer, description, queries, metadata, desiredState, skipRecompile } =
		options;

	try {
		const instance = databaseInstancesQueries.getById(databaseId);
		if (!instance) {
			return { success: false, error: 'Database instance not found' };
		}

		if (layer === 'base' && (!instance.personal_access_token || instance.local_ops_enabled)) {
			return {
				success: false,
				error: 'Base layer requires a personal access token and local ops must be disabled'
			};
		}

		// Convert queries to SQL first (needed for validation)
		const sqlStatements = queries.map(compiledQueryToSql);

		// Validate against current cache
		const cache = getCache(databaseId);
		if (cache) {
			const validation = cache.validateSql(sqlStatements);
			if (!validation.valid) {
				await logger.error('Operation validation failed - refusing to write', {
					source: 'PCDWriter',
					meta: {
						databaseId,
						layer,
						description,
						error: validation.error,
						queries: sqlStatements
					}
				});
				return {
					success: false,
					error: `Validation failed: ${validation.error}`
				};
			}
		} else {
			await logger.warn('No cache available for validation - proceeding without validation', {
				source: 'PCDWriter',
				meta: { databaseId, description }
			});
		}

		if (metadata && (await cancelOutCreate(databaseId, layer, metadata))) {
			if (!skipRecompile) {
				await compile(instance.local_path, instance.id);
			}
			return { success: true };
		}

		const sqlContent = `${sqlStatements.join(';\n\n')};`.trim();
		const metadataJson = buildMetadataJson(metadata);
		const desiredStateJson = serializeDesiredState(desiredState);
		const contentHash = await hashContent(sqlContent, metadataJson);

		const origin: PcdOpOrigin = layer === 'base' ? 'base' : 'user';
		const state = layer === 'base' ? 'draft' : 'published';

		const opId = pcdOpsQueries.create({
			databaseId,
			origin,
			state,
			source: 'local',
			sql: sqlContent,
			metadata: metadataJson,
			desiredState: desiredStateJson,
			contentHash
		});

		const opType = metadata?.operation ?? 'write';
		const entity = metadata?.entity?.replace(/_/g, ' ') ?? 'operation';
		const entityName = metadata?.name ?? '';
		const message = `${opType.charAt(0).toUpperCase() + opType.slice(1)} ${entity} "${entityName}" in ${origin} layer`;

		if (metadata?.operation === 'create' || metadata?.operation === 'delete') {
			await logger.info(message, {
				source: 'PCDWriter',
				meta: { databaseId, opId, layer: origin, entity: metadata.entity, name: metadata.name }
			});
		}

		if (
			origin === 'user' &&
			metadata &&
			(metadata.operation === 'update' || metadata.operation === 'delete')
		) {
			await supersedePriorUserOps(databaseId, opId, metadata);
		}

		if (!skipRecompile) {
			await compile(instance.local_path, instance.id);

			await logger.debug('Cache recompiled after write', {
				source: 'PCDWriter',
				meta: { databaseId }
			});
		}

		return { success: true, filepath: `pcd_ops:${opId}` };
	} catch (error) {
		await logger.error('Failed to write operation', {
			source: 'PCDWriter',
			meta: { error: String(error), databaseId, layer, description }
		});
		return { success: false, error: String(error) };
	}
}

/**
 * Recompile the cache for a database instance.
 * Use after a batch of writeOperation calls with skipRecompile: true.
 */
export async function recompileCache(databaseId: number): Promise<void> {
	const instance = databaseInstancesQueries.getById(databaseId);
	if (!instance) return;
	await compile(instance.local_path, instance.id);
	await logger.debug('Cache recompiled after batch write', {
		source: 'PCDWriter',
		meta: { databaseId }
	});
}

/**
 * Check if a database instance can write to the base layer
 */
export function canWriteToBase(databaseId: number): boolean {
	const instance = databaseInstancesQueries.getById(databaseId);
	return !!instance?.personal_access_token && !instance?.local_ops_enabled;
}

// Re-export types for convenience
export type { OperationType, OperationMetadata, WriteOptions, WriteResult };
