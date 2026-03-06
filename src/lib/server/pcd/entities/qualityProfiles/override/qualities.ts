import { getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import type { OrderedItem } from '$shared/pcd/display.ts';
import { qualities as readQualities } from '../qualities/read.ts';
import { updateQualities } from '../qualities/update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import { orderedItemsEqual } from '$pcd/conflicts/overrideUtils.ts';
import { resolveProfileName } from './resolve.ts';

/**
 * Qualities update payloads:
 * - Legacy full-list: ordered_items: { from: [...], to: [...] } or ordered_items: [...]
 * - Row patch: ordered_items: { mode, key, from: [item?], to: [item?] }
 */
function resolveOrderedItems(desiredState: StoredDesiredState): OrderedItem[] | null {
	const field = desiredState.ordered_items;
	if (!field) return null;

	// { from, to } diff — take the "to" side
	if (typeof field === 'object' && 'to' in field) {
		const to = (field as { to: unknown }).to;
		if (Array.isArray(to)) return to as OrderedItem[];
	}

	// Flat array (unlikely but handle it)
	if (Array.isArray(field)) return field as OrderedItem[];

	return null;
}

type OrderedItemsPatch = {
	mode: 'add' | 'remove' | 'update';
	key: string | null;
	from: OrderedItem | null;
	to: OrderedItem | null;
};

function resolveOrderedItemsPatch(desiredState: StoredDesiredState): OrderedItemsPatch | null {
	const raw = desiredState.ordered_items;
	if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

	const record = raw as Record<string, unknown>;
	if (record.mode !== 'add' && record.mode !== 'remove' && record.mode !== 'update') {
		return null;
	}

	const from = Array.isArray(record.from)
		? ((record.from[0] as OrderedItem | undefined) ?? null)
		: null;
	const to = Array.isArray(record.to) ? ((record.to[0] as OrderedItem | undefined) ?? null) : null;
	const key = typeof record.key === 'string' ? record.key : null;

	return {
		mode: record.mode,
		key,
		from,
		to
	};
}

function itemKey(item: OrderedItem): string {
	return `${item.type}:${item.name}`;
}

function cloneItem(item: OrderedItem): OrderedItem {
	return {
		type: item.type,
		name: item.name,
		position: item.position,
		enabled: item.enabled,
		upgradeUntil: item.upgradeUntil,
		members: item.members ? item.members.map((member) => ({ name: member.name })) : undefined
	};
}

function applyPatch(currentItems: OrderedItem[], patch: OrderedItemsPatch): OrderedItem[] {
	const map = new Map(currentItems.map((item) => [itemKey(item), cloneItem(item)]));

	if (patch.mode === 'add') {
		if (!patch.to) return currentItems;
		map.set(itemKey(patch.to), cloneItem(patch.to));
	}

	if (patch.mode === 'remove') {
		const key = patch.key ?? (patch.from ? itemKey(patch.from) : null);
		if (key) {
			map.delete(key);
		}
	}

	if (patch.mode === 'update') {
		if (!patch.to && !patch.from) return currentItems;

		const fromKey = patch.from ? itemKey(patch.from) : patch.key;
		const toKey = patch.to ? itemKey(patch.to) : patch.key;

		if (fromKey && toKey && fromKey !== toKey) {
			map.delete(fromKey);
		}
		if (toKey && patch.to) {
			map.set(toKey, cloneItem(patch.to));
		}
	}

	return Array.from(map.values()).sort((a, b) => a.position - b.position);
}

export async function overrideQualities(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for qualities override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const profileName = await resolveProfileName(cache, databaseId, metadata, desiredState);
	if (!profileName) {
		return { success: false, error: 'Quality profile not found for qualities override' };
	}

	// Read current qualities to compare
	const currentData = await readQualities(cache, databaseId, profileName);
	const patch = resolveOrderedItemsPatch(desiredState);

	if (patch) {
		const nextItems = applyPatch(currentData.orderedItems, patch);
		if (orderedItemsEqual(currentData.orderedItems, nextItems)) {
			return { success: true };
		}

		return updateQualities({
			databaseId,
			cache,
			layer: 'user',
			profileName,
			input: { orderedItems: nextItems }
		});
	}

	const desiredItems = resolveOrderedItems(desiredState);
	if (!desiredItems || orderedItemsEqual(currentData.orderedItems, desiredItems)) {
		return { success: true };
	}

	return updateQualities({
		databaseId,
		cache,
		layer: 'user',
		profileName,
		input: { orderedItems: desiredItems }
	});
}
