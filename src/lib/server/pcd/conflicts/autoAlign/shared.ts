import type { Database } from '@jsr/db__sqlite';
import type { AutoAlignEntity } from '$pcd/entities/registry.ts';
import { AUTO_ALIGN_ENTITIES } from '$pcd/entities/registry.ts';
import type { ParsedOpMetadata } from './types.ts';

export function isFromTo(value: unknown): value is { to: unknown } {
	if (!value || typeof value !== 'object') return false;
	return 'to' in value;
}

export function valuesEqual(expected: unknown, actual: unknown): boolean {
	if (expected === null || expected === undefined) {
		return actual === null || actual === undefined;
	}
	if (typeof expected === 'boolean') {
		if (typeof actual === 'boolean') return expected === actual;
		if (typeof actual === 'number') return actual === (expected ? 1 : 0);
		if (typeof actual === 'string') return actual === (expected ? '1' : '0');
		return false;
	}
	if (typeof expected === 'number') {
		if (typeof actual === 'number') return expected === actual;
		if (typeof actual === 'bigint') return expected === Number(actual);
		if (typeof actual === 'string') return expected === Number(actual);
		return false;
	}
	if (typeof expected === 'string') {
		return String(actual) === expected;
	}
	return false;
}

export function fetchRow(
	db: Database,
	table: string,
	keyColumn: string,
	keyValue: string
): Record<string, unknown> | null {
	try {
		// nosemgrep: profilarr.sql.template-literal-interpolation — table/column from hardcoded callers, can't parameterize
		const row = db.prepare(`SELECT * FROM ${table} WHERE ${keyColumn} = ? LIMIT 1`).get(keyValue);
		return (row as Record<string, unknown> | undefined) ?? null;
	} catch {
		return null;
	}
}

export function resolveCurrentRow(
	db: Database,
	entity: AutoAlignEntity,
	metadata: ParsedOpMetadata | null,
	desiredState: Record<string, unknown> | null
): Record<string, unknown> | null {
	const stableKey = metadata?.stableKey?.value;
	if (stableKey) {
		const row = fetchRow(db, entity.table, entity.keyColumn, stableKey);
		if (row) return row;
	}

	const nameKey = metadata?.name;
	if (nameKey) {
		const row = fetchRow(db, entity.table, entity.keyColumn, nameKey);
		if (row) return row;
	}

	const desiredName = desiredState?.name;
	if (isFromTo(desiredName) && typeof desiredName.to === 'string') {
		return fetchRow(db, entity.table, entity.keyColumn, desiredName.to);
	}

	return null;
}

export function isMissingTargetRow(
	db: Database,
	entityName: string | undefined,
	metadata: ParsedOpMetadata | null
): boolean {
	if (!entityName) return false;
	const entityConfig = AUTO_ALIGN_ENTITIES.get(entityName);
	if (!entityConfig) return false;

	const stableKey = metadata?.stableKey?.value ?? metadata?.name;
	if (!stableKey) return false;

	const row = fetchRow(db, entityConfig.table, entityConfig.keyColumn, stableKey);
	return !row;
}
