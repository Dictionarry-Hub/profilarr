/**
 * Update quality profile qualities
 */

import type { PCDCache } from '$pcd/index.ts';
import { type OperationLayer, writeOperation } from '$pcd/index.ts';
import type { OrderedItem } from '$shared/pcd/display.ts';
import { logger } from '$logger/logger.ts';
import { qualities as readQualities } from './read.ts';
import type { CompiledQuery } from 'kysely';

// ============================================================================
// Input types
// ============================================================================

interface UpdateQualitiesInput {
	orderedItems: OrderedItem[];
}

interface UpdateQualitiesOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	profileName: string;
	input: UpdateQualitiesInput;
}

type RowChangeMode = 'add' | 'remove' | 'update';

interface QualityRowOp {
	description: string;
	queries: CompiledQuery[];
	desiredState: Record<string, unknown>;
	changedFields: string[];
	summary: string;
	title: string;
}

// ============================================================================
// Mutations
// ============================================================================

function esc(str: string): string {
	return str.replace(/'/g, "''");
}

function rowKey(item: OrderedItem): string {
	return `${item.type}:${item.name}`;
}

function rowFieldKey(item: OrderedItem): string {
	return `quality_item:${item.type}:${item.name}`;
}

function getMembers(item: OrderedItem): string[] {
	if (item.type !== 'group') return [];
	return Array.from(
		new Set((item.members ?? []).map((member) => member.name).filter(Boolean))
	).sort();
}

function cloneItem(item: OrderedItem): OrderedItem {
	const cloned: OrderedItem = {
		type: item.type,
		name: item.name,
		position: item.position,
		enabled: item.enabled,
		upgradeUntil: item.upgradeUntil
	};
	if (item.type === 'group') {
		cloned.members = (item.members ?? []).map((m) => ({ name: m.name }));
	}
	return cloned;
}

function sameRow(current: OrderedItem, next: OrderedItem): boolean {
	if (
		current.type !== next.type ||
		current.name !== next.name ||
		current.position !== next.position ||
		current.enabled !== next.enabled ||
		current.upgradeUntil !== next.upgradeUntil
	) {
		return false;
	}

	if (current.type !== 'group') {
		return true;
	}

	const currentMembers = (current.members ?? []).map((m) => m.name).filter(Boolean);
	const nextMembers = (next.members ?? []).map((m) => m.name).filter(Boolean);
	if (currentMembers.length !== nextMembers.length) return false;
	return currentMembers.every((member, index) => member === nextMembers[index]);
}

function buildGroupMembersGuard(profileName: string, groupName: string, members: string[]): string {
	const baseWhere = `quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(groupName)}'`;

	if (members.length === 0) {
		return `(SELECT COUNT(*)
FROM quality_group_members
WHERE ${baseWhere}) = 0`;
	}

	const expectedMembers = members.map((member) => `'${esc(member)}'`).join(', ');
	const positionChecks = members.map(
		(member, index) =>
			`(quality_name = '${esc(member)}'
        AND position = ${index})`
	).join(`
      OR `);

	return `(SELECT COUNT(*)
FROM quality_group_members
WHERE ${baseWhere}) = ${members.length}
  AND NOT EXISTS (
    SELECT 1
    FROM quality_group_members
    WHERE ${baseWhere}
      AND quality_name NOT IN (${expectedMembers})
  )
  AND (
    NOT EXISTS (
      SELECT 1
      FROM quality_group_members
      WHERE ${baseWhere}
        AND NOT (
          ${positionChecks}
        )
    )
    OR NOT EXISTS (
      SELECT 1
      FROM quality_group_members
      WHERE ${baseWhere}
        AND position != 0
    )
  )`;
}

function buildDeleteQueries(profileName: string, item: OrderedItem): CompiledQuery[] {
	const queries: CompiledQuery[] = [];

	if (item.type === 'quality') {
		queries.push({
			sql: `DELETE FROM quality_profile_qualities
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_name = '${esc(item.name)}'
  AND quality_group_name IS NULL
  AND position = ${item.position}
  AND enabled = ${item.enabled ? 1 : 0}
  AND upgrade_until = ${item.upgradeUntil ? 1 : 0}`,
			parameters: [],
			query: {} as never
		});
		return queries;
	}

	queries.push({
		sql: `DELETE FROM quality_profile_qualities
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(item.name)}'
  AND quality_name IS NULL
  AND position = ${item.position}
  AND enabled = ${item.enabled ? 1 : 0}
  AND upgrade_until = ${item.upgradeUntil ? 1 : 0}`,
		parameters: [],
		query: {} as never
	});

	for (const member of getMembers(item)) {
		queries.push({
			sql: `DELETE FROM quality_group_members
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(item.name)}'
  AND quality_name = '${esc(member)}'`,
			parameters: [],
			query: {} as never
		});
	}

	queries.push({
		sql: `DELETE FROM quality_groups
WHERE quality_profile_name = '${esc(profileName)}'
  AND name = '${esc(item.name)}'`,
		parameters: [],
		query: {} as never
	});

	return queries;
}

function buildAddQueries(profileName: string, item: OrderedItem): CompiledQuery[] {
	const queries: CompiledQuery[] = [];
	const enabled = item.enabled ? 1 : 0;
	const upgradeUntil = item.upgradeUntil ? 1 : 0;

	if (item.type === 'group') {
		queries.push({
			sql: `INSERT INTO quality_groups (quality_profile_name, name)
SELECT '${esc(profileName)}', '${esc(item.name)}'
WHERE NOT EXISTS (
  SELECT 1 FROM quality_groups
  WHERE quality_profile_name = '${esc(profileName)}'
    AND name = '${esc(item.name)}'
)`,
			parameters: [],
			query: {} as never
		});

		const members = Array.from(new Set((item.members ?? []).map((m) => m.name).filter(Boolean)));
		for (let i = 0; i < members.length; i++) {
			queries.push({
				sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position)
SELECT '${esc(profileName)}', '${esc(item.name)}', '${esc(members[i])}', ${i}
WHERE NOT EXISTS (
  SELECT 1 FROM quality_group_members
  WHERE quality_profile_name = '${esc(profileName)}'
    AND quality_group_name = '${esc(item.name)}'
    AND quality_name = '${esc(members[i])}'
)`,
				parameters: [],
				query: {} as never
			});
		}

		queries.push({
			sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until)
SELECT '${esc(profileName)}', NULL, '${esc(
				item.name
			)}', ${item.position}, ${enabled}, ${upgradeUntil}
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_qualities
  WHERE quality_profile_name = '${esc(profileName)}'
    AND quality_name IS NULL
    AND quality_group_name = '${esc(item.name)}'
)`,
			parameters: [],
			query: {} as never
		});

		return queries;
	}

	queries.push({
		sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until)
SELECT '${esc(profileName)}', '${esc(
			item.name
		)}', NULL, ${item.position}, ${enabled}, ${upgradeUntil}
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_qualities
  WHERE quality_profile_name = '${esc(profileName)}'
    AND quality_name = '${esc(item.name)}'
    AND quality_group_name IS NULL
)`,
		parameters: [],
		query: {} as never
	});

	return queries;
}

function buildUpdateQueries(
	profileName: string,
	current: OrderedItem,
	next: OrderedItem
): CompiledQuery[] {
	const queries: CompiledQuery[] = [];

	const parts: string[] = [];
	if (current.position !== next.position) {
		parts.push(`position = ${next.position}`);
	}
	if (current.enabled !== next.enabled) {
		parts.push(`enabled = ${next.enabled ? 1 : 0}`);
	}
	if (current.upgradeUntil !== next.upgradeUntil) {
		parts.push(`upgrade_until = ${next.upgradeUntil ? 1 : 0}`);
	}

	if (parts.length > 0) {
		if (current.type === 'quality') {
			queries.push({
				sql: `UPDATE quality_profile_qualities
SET ${parts.join(', ')}
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_name = '${esc(current.name)}'
  AND quality_group_name IS NULL
  AND position = ${current.position}
  AND enabled = ${current.enabled ? 1 : 0}
  AND upgrade_until = ${current.upgradeUntil ? 1 : 0}`,
				parameters: [],
				query: {} as never
			});
		} else {
			queries.push({
				sql: `UPDATE quality_profile_qualities
SET ${parts.join(', ')}
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(current.name)}'
  AND quality_name IS NULL
  AND position = ${current.position}
  AND enabled = ${current.enabled ? 1 : 0}
  AND upgrade_until = ${current.upgradeUntil ? 1 : 0}`,
				parameters: [],
				query: {} as never
			});
		}
	}

	if (current.type === 'group') {
		const currentMembers = (current.members ?? []).map((m) => m.name).filter(Boolean);
		const nextMembers = (next.members ?? []).map((m) => m.name).filter(Boolean);
		const membersChanged =
			currentMembers.length !== nextMembers.length ||
			currentMembers.some((m, i) => m !== nextMembers[i]);

		if (membersChanged) {
			const membersGuard = buildGroupMembersGuard(profileName, current.name, currentMembers);

			queries.push({
				sql: `DELETE FROM quality_group_members
WHERE quality_profile_name = '${esc(profileName)}'
  AND quality_group_name = '${esc(current.name)}'
  AND ${membersGuard}`,
				parameters: [],
				query: {} as never
			});

			if (nextMembers.length > 0) {
				const insertRows = nextMembers.map(
					(member, index) =>
						`SELECT '${esc(profileName)}' AS quality_profile_name, '${esc(
							current.name
						)}' AS quality_group_name, '${esc(member)}' AS quality_name, ${index} AS position`
				).join(`
UNION ALL
`);

				queries.push({
					sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position)
WITH can_insert AS (
  SELECT (
    SELECT COUNT(*)
    FROM quality_group_members
    WHERE quality_profile_name = '${esc(profileName)}'
      AND quality_group_name = '${esc(current.name)}'
  ) = 0 AS ok
),
new_rows AS (
${insertRows}
)
SELECT
  new_rows.quality_profile_name,
  new_rows.quality_group_name,
  new_rows.quality_name,
  new_rows.position
FROM new_rows
CROSS JOIN can_insert
WHERE ok`,
					parameters: [],
					query: {} as never
				});
			}
		}
	}

	return queries;
}

function rowDesiredState(
	mode: RowChangeMode,
	key: string,
	fromItem: OrderedItem | null,
	toItem: OrderedItem | null
): Record<string, unknown> {
	return {
		ordered_items: {
			mode,
			key,
			from: fromItem ? [cloneItem(fromItem)] : [],
			to: toItem ? [cloneItem(toItem)] : []
		}
	};
}

/**
 * Update quality profile qualities configuration
 */
export async function updateQualities(options: UpdateQualitiesOptions) {
	const { databaseId, cache, layer, profileName, input } = options;

	const upgradeUntilCount = input.orderedItems.filter((item) => item.upgradeUntil).length;
	if (upgradeUntilCount > 1) {
		throw new Error('Only one quality can be marked as "upgrade until"');
	}

	const currentData = await readQualities(cache, databaseId, profileName);
	const currentByKey = new Map(currentData.orderedItems.map((item) => [rowKey(item), item]));
	const nextByKey = new Map(input.orderedItems.map((item) => [rowKey(item), item]));

	const removedItems = currentData.orderedItems.filter((item) => !nextByKey.has(rowKey(item)));
	const addedItems = input.orderedItems.filter((item) => !currentByKey.has(rowKey(item)));
	const updatedItems: Array<{ current: OrderedItem; next: OrderedItem }> = [];

	for (const [key, next] of nextByKey.entries()) {
		const current = currentByKey.get(key);
		if (!current) continue;
		if (!sameRow(current, next)) {
			updatedItems.push({ current, next });
		}
	}

	if (removedItems.length === 0 && addedItems.length === 0 && updatedItems.length === 0) {
		return { success: true };
	}

	await logger.info(`Save quality profile qualities "${profileName}"`, {
		source: 'QualityProfile',
		meta: {
			profileName,
			removed: removedItems.length,
			added: addedItems.length,
			updated: updatedItems.length
		}
	});

	const rowOps: QualityRowOp[] = [];

	for (const item of removedItems) {
		rowOps.push({
			description: `remove-quality-profile-row-${profileName}-${item.type}-${item.name}`,
			queries: buildDeleteQueries(profileName, item),
			desiredState: rowDesiredState('remove', rowKey(item), item, null),
			changedFields: [rowFieldKey(item)],
			summary: 'Remove quality profile quality row',
			title: `Remove ${item.type} "${item.name}" from quality profile "${profileName}"`
		});
	}

	for (const item of addedItems) {
		rowOps.push({
			description: `add-quality-profile-row-${profileName}-${item.type}-${item.name}`,
			queries: buildAddQueries(profileName, item),
			desiredState: rowDesiredState('add', rowKey(item), null, item),
			changedFields: [rowFieldKey(item)],
			summary: 'Add quality profile quality row',
			title: `Add ${item.type} "${item.name}" to quality profile "${profileName}"`
		});
	}

	// Sort updates so rows clearing upgrade_until (→false) come before rows
	// setting it (→true). The partial UNIQUE index idx_one_upgrade_until_per_profile
	// only allows one upgrade_until=1 per profile, so the clear must run first.
	const sortedUpdates = [...updatedItems].sort((a, b) => {
		if (a.next.upgradeUntil === b.next.upgradeUntil) return 0;
		return a.next.upgradeUntil ? 1 : -1;
	});

	for (const change of sortedUpdates) {
		const queries = buildUpdateQueries(profileName, change.current, change.next);
		if (queries.length === 0) continue;

		rowOps.push({
			description: `update-quality-profile-row-${profileName}-${change.next.type}-${change.next.name}`,
			queries,
			desiredState: rowDesiredState('update', rowKey(change.next), change.current, change.next),
			changedFields: [rowFieldKey(change.next)],
			summary: 'Update quality profile quality row',
			title: `Update ${change.next.type} "${change.next.name}" on quality profile "${profileName}"`
		});
	}

	if (rowOps.length === 0) {
		return { success: true };
	}

	// Batch all row changes into a single atomic operation so the entire
	// qualities update conflicts (or doesn't) as one unit.
	const allQueries = rowOps.flatMap((op) => op.queries);
	const allChangedFields = rowOps.flatMap((op) => op.changedFields);
	const desiredState = {
		ordered_items: {
			from: currentData.orderedItems.map(cloneItem),
			to: input.orderedItems.map(cloneItem)
		}
	};

	return writeOperation({
		databaseId,
		layer,
		description: `update-quality-profile-qualities-${profileName}`,
		queries: allQueries,
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'quality_profile',
			name: profileName,
			stableKey: { key: 'quality_profile_name', value: profileName },
			changedFields: allChangedFields,
			summary: 'Update quality profile qualities',
			title: `Update qualities on quality profile "${profileName}"`
		}
	});
}
