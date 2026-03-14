import type { Database } from '@jsr/db__sqlite';
import type { ParsedOpMetadata, UpdateRule } from '../types.ts';
import { readCurrentOrderedItems } from '../../fullListCheck.ts';
import { orderedItemsEqual } from '../../overrideUtils.ts';
import { hasQualityGroupMembersPositionInDb } from '$pcd/entities/qualityProfiles/qualities/groupMembersSchema.ts';

type NormalizedQualityRow = {
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: boolean;
	upgradeUntil: boolean;
	members: string[];
};

function toBoolean(value: unknown): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value !== 0;
	if (typeof value === 'string') {
		const normalized = value.trim().toLowerCase();
		return normalized === '1' || normalized === 'true';
	}
	return false;
}

function parseQualityKey(key: unknown): { type: 'quality' | 'group'; name: string } | null {
	if (typeof key !== 'string' || key.length === 0) return null;
	const firstColon = key.indexOf(':');
	if (firstColon <= 0) return null;
	const type = key.slice(0, firstColon);
	const name = key.slice(firstColon + 1);
	if ((type !== 'quality' && type !== 'group') || name.length === 0) {
		return null;
	}
	return { type, name };
}

function normalizeMembers(value: unknown): string[] {
	if (!Array.isArray(value)) return [];
	const members = value
		.map((member) => {
			if (typeof member === 'string') return member;
			if (member && typeof member === 'object' && 'name' in member) {
				const name = (member as { name?: unknown }).name;
				return typeof name === 'string' ? name : '';
			}
			return '';
		})
		.filter((name) => name.length > 0);
	return Array.from(new Set(members));
}

function parseQualityRow(value: unknown): NormalizedQualityRow | null {
	if (!value || typeof value !== 'object') return null;
	const row = value as {
		type?: unknown;
		name?: unknown;
		position?: unknown;
		enabled?: unknown;
		upgradeUntil?: unknown;
		upgrade_until?: unknown;
		members?: unknown;
	};

	if (row.type !== 'quality' && row.type !== 'group') return null;
	if (typeof row.name !== 'string' || row.name.length === 0) return null;
	if (typeof row.position !== 'number' || !Number.isFinite(row.position)) {
		return null;
	}

	const upgradeRaw = row.upgradeUntil ?? row.upgrade_until;
	return {
		type: row.type,
		name: row.name,
		position: row.position,
		enabled: toBoolean(row.enabled),
		upgradeUntil: toBoolean(upgradeRaw),
		members: row.type === 'group' ? normalizeMembers(row.members) : []
	};
}

function qualityRowsEqual(a: NormalizedQualityRow, b: NormalizedQualityRow): boolean {
	if (
		a.type !== b.type ||
		a.name !== b.name ||
		a.position !== b.position ||
		a.enabled !== b.enabled ||
		a.upgradeUntil !== b.upgradeUntil
	) {
		return false;
	}

	if (a.type !== 'group') return true;
	if (a.members.length !== b.members.length) return false;

	return a.members.every((member, index) => member === b.members[index]);
}

function fetchQualityProfileRow(
	db: Database,
	profileName: string,
	ref: { type: 'quality' | 'group'; name: string }
): NormalizedQualityRow | null {
	const baseRow =
		ref.type === 'quality'
			? db
					.prepare(
						`SELECT position, enabled, upgrade_until
FROM quality_profile_qualities
WHERE quality_profile_name = ?
  AND quality_name = ?
  AND quality_group_name IS NULL
LIMIT 1`
					)
					.get(profileName, ref.name)
			: db
					.prepare(
						`SELECT position, enabled, upgrade_until
FROM quality_profile_qualities
WHERE quality_profile_name = ?
  AND quality_group_name = ?
  AND quality_name IS NULL
LIMIT 1`
					)
					.get(profileName, ref.name);

	if (!baseRow) return null;
	const typedRow = baseRow as {
		position: number;
		enabled: number;
		upgrade_until: number;
	};

	let members: string[] = [];
	if (ref.type === 'group') {
		const hasGroupMemberPosition = hasQualityGroupMembersPositionInDb(db);
		const memberRows = db
			.prepare(
				`SELECT quality_name
FROM quality_group_members
WHERE quality_profile_name = ?
  AND quality_group_name = ?
ORDER BY ${hasGroupMemberPosition ? 'position, ' : ''}quality_name`
			)
			.all(profileName, ref.name) as Array<{ quality_name: string }>;
		members = memberRows.map((row) => row.quality_name);
	}

	return {
		type: ref.type,
		name: ref.name,
		position: Number(typedRow.position),
		enabled: Number(typedRow.enabled) === 1,
		upgradeUntil: Number(typedRow.upgrade_until) === 1,
		members
	};
}

function shouldAutoAlignQualityProfileQualitiesRow(
	db: Database,
	metadata: ParsedOpMetadata | null,
	desiredState: Record<string, unknown>
): boolean {
	const profileName = metadata?.stableKey?.value ?? metadata?.name;
	if (!profileName) return false;

	const orderedItems = desiredState.ordered_items;
	if (!orderedItems || typeof orderedItems !== 'object') return false;
	const rowPayload = orderedItems as {
		mode?: unknown;
		key?: unknown;
		from?: unknown;
		to?: unknown;
	};

	// Full-list format (atomic op): auto-align if current state matches "to"
	if (!rowPayload.mode && Array.isArray(rowPayload.from) && Array.isArray(rowPayload.to)) {
		const currentItems = readCurrentOrderedItems(db, profileName);
		return orderedItemsEqual(currentItems, rowPayload.to);
	}

	if (rowPayload.mode !== 'add' && rowPayload.mode !== 'remove' && rowPayload.mode !== 'update') {
		return false;
	}

	const fromRows = Array.isArray(rowPayload.from) ? rowPayload.from : [];
	const toRows = Array.isArray(rowPayload.to) ? rowPayload.to : [];
	const fromRow = fromRows.length > 0 ? parseQualityRow(fromRows[0]) : null;
	const toRow = toRows.length > 0 ? parseQualityRow(toRows[0]) : null;
	const keyRef = parseQualityKey(rowPayload.key);

	if (rowPayload.mode === 'remove') {
		const identity = fromRow ? { type: fromRow.type, name: fromRow.name } : keyRef;
		if (!identity) return false;
		return fetchQualityProfileRow(db, profileName, identity) === null;
	}

	const desiredRow = toRow;
	if (!desiredRow) return false;
	const currentRow = fetchQualityProfileRow(db, profileName, {
		type: desiredRow.type,
		name: desiredRow.name
	});
	if (!currentRow) return false;

	return qualityRowsEqual(desiredRow, currentRow);
}

export const qualityProfileQualitiesRowRule: UpdateRule = {
	name: 'quality_profile_qualities_row',
	matches: ({ entityName, desiredState }) =>
		entityName === 'quality_profile' && !!desiredState && 'ordered_items' in desiredState,
	shouldAlign: ({ db, metadata, desiredState }) =>
		shouldAutoAlignQualityProfileQualitiesRow(db, metadata, desiredState ?? {})
};
