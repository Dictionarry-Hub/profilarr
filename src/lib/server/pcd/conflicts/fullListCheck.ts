/**
 * Post-execution conflict detection for multi-statement ops.
 *
 * When a user op contains multiple SQL statements (e.g. an atomic quality
 * profile qualities update), some statements may fail their guards while
 * others succeed. The aggregate rowcount is > 0, so the standard
 * rowcount === 0 check misses the conflict.
 *
 * This module detects such partial failures by comparing the DB state
 * after execution against the op's desired "to" state.
 */

import type { Database } from '@jsr/db__sqlite';
import type { ParsedOpMetadata } from './autoAlign/types.ts';
import { orderedItemsEqual } from './overrideUtils.ts';
import { hasQualityGroupMembersPositionInDb } from '$pcd/entities/qualityProfiles/qualities/groupMembersSchema.ts';

/**
 * Check if a user op with a full-list desiredState actually achieved its
 * desired "to" state. Returns true if a conflict is detected (state
 * does not match "to").
 */
export function checkFullListConflict(
	db: Database,
	metadata: ParsedOpMetadata | null,
	desiredState: Record<string, unknown> | null
): boolean {
	if (!desiredState) return false;

	const oi = desiredState.ordered_items;
	if (!oi || typeof oi !== 'object' || Array.isArray(oi)) return false;

	const record = oi as Record<string, unknown>;
	// Full-list format has from/to arrays and no mode (distinguishes from row patches)
	if (!Array.isArray(record.from) || !Array.isArray(record.to) || 'mode' in record) {
		return false;
	}

	const profileName = metadata?.stableKey?.value ?? metadata?.name;
	if (!profileName) return false;

	const currentItems = readCurrentOrderedItems(db, profileName);
	return !orderedItemsEqual(currentItems, record.to);
}

/**
 * Read all quality profile ordered items from the in-memory DB.
 */
export function readCurrentOrderedItems(db: Database, profileName: string): unknown[] {
	const rows = db
		.prepare(
			`SELECT
	CASE WHEN quality_name IS NOT NULL THEN 'quality' ELSE 'group' END as type,
	COALESCE(quality_name, quality_group_name) as name,
	position,
	enabled,
	upgrade_until
FROM quality_profile_qualities
WHERE quality_profile_name = ?
ORDER BY position`
		)
		.all(profileName) as Array<{
		type: string;
		name: string;
		position: number;
		enabled: number;
		upgrade_until: number;
	}>;

	const memberRows = db
		.prepare(
			`SELECT quality_group_name, quality_name
FROM quality_group_members
WHERE quality_profile_name = ?
ORDER BY quality_group_name, ${hasQualityGroupMembersPositionInDb(db) ? 'position, ' : ''}quality_name`
		)
		.all(profileName) as Array<{
		quality_group_name: string;
		quality_name: string;
	}>;

	const membersByGroup = new Map<string, string[]>();
	for (const row of memberRows) {
		const existing = membersByGroup.get(row.quality_group_name) ?? [];
		existing.push(row.quality_name);
		membersByGroup.set(row.quality_group_name, existing);
	}

	return rows.map((row) => ({
		type: row.type,
		name: row.name,
		position: row.position,
		enabled: row.enabled === 1,
		upgradeUntil: row.upgrade_until === 1,
		...(row.type === 'group'
			? { members: (membersByGroup.get(row.name) ?? []).map((n) => ({ name: n })) }
			: {})
	}));
}
