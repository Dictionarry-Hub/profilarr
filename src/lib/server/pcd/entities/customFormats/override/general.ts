import { getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import { general as readCustomFormatGeneral } from '../general/read.ts';
import { updateGeneral } from '../general/update.ts';
import { create as createCustomFormat } from '../create.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import {
	getDesiredTo,
	normalizeTags,
	normalizeText,
	tagsEqual
} from '$pcd/conflicts/overrideUtils.ts';
import { resolveFormatName } from './resolve.ts';

function resolveBoolean(value: unknown, fallback: boolean): boolean {
	if (typeof value === 'boolean') return value;
	if (typeof value === 'number') return value === 1;
	if (typeof value === 'string') {
		if (value === '1' || value.toLowerCase() === 'true') return true;
		if (value === '0' || value.toLowerCase() === 'false') return false;
	}
	return fallback;
}

function resolveTags(current: string[], desiredState: StoredDesiredState): string[] {
	const desiredTags = desiredState.tags;
	if (Array.isArray(desiredTags)) {
		return normalizeTags(desiredTags);
	}
	if (desiredTags && typeof desiredTags === 'object') {
		const add = Array.isArray((desiredTags as { add?: unknown }).add)
			? ((desiredTags as { add: unknown[] }).add as unknown[]).map((tag) => String(tag))
			: [];
		const remove = Array.isArray((desiredTags as { remove?: unknown }).remove)
			? ((desiredTags as { remove: unknown[] }).remove as unknown[]).map((tag) => String(tag))
			: [];
		const set = new Set(current);
		for (const tag of remove) set.delete(tag);
		for (const tag of add) set.add(tag);
		return Array.from(set);
	}
	return current;
}

export async function overrideGeneral(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const formatName = await resolveFormatName(cache, databaseId, metadata, desiredState);
	const fallbackName =
		metadata?.stable_key?.value ??
		metadata?.name ??
		getDesiredTo<string>(desiredState?.name) ??
		(typeof desiredState?.name === 'string' ? (desiredState.name as string) : null);

	if (!formatName && !fallbackName) {
		return { success: false, error: 'Custom format not found for override' };
	}

	const formatRow = formatName
		? await cache.kb
				.selectFrom('custom_formats')
				.select(['id', 'name'])
				.where('name', '=', formatName)
				.executeTakeFirst()
		: undefined;

	const desiredNameRaw =
		getDesiredTo<string>(desiredState.name) ??
		(typeof desiredState.name === 'string'
			? desiredState.name
			: (formatName ?? fallbackName ?? ''));
	const desiredDescriptionRaw =
		getDesiredTo<string | null>(desiredState.description) ??
		(typeof desiredState.description === 'string' || desiredState.description === null
			? (desiredState.description as string | null)
			: undefined);
	const desiredIncludeRaw =
		getDesiredTo(desiredState.include_in_rename) ?? desiredState.include_in_rename;
	const desiredTags = resolveTags([], desiredState);

	if (!formatRow) {
		const createName = desiredNameRaw || fallbackName || formatName || '';
		if (!createName) {
			return { success: false, error: 'Custom format not found for override' };
		}

		const createInclude = resolveBoolean(desiredIncludeRaw, false);

		return createCustomFormat({
			databaseId,
			cache,
			layer: 'user',
			input: {
				name: createName,
				description: normalizeText((desiredDescriptionRaw ?? '') as string),
				includeInRename: createInclude,
				tags: desiredTags
			}
		});
	}

	const current = await readCustomFormatGeneral(cache, formatRow.id);
	if (!current) {
		return { success: false, error: 'Custom format not found for override' };
	}

	const currentTags = current.tags.map((tag) => tag.name);
	const resolvedTags = resolveTags(currentTags, desiredState);

	const hasDesiredName = desiredNameRaw !== undefined || typeof desiredState.name === 'string';
	const desiredName = hasDesiredName ? (desiredNameRaw as string) : current.name;

	const hasDesiredDescription =
		desiredDescriptionRaw !== undefined ||
		typeof desiredState.description === 'string' ||
		desiredState.description === null;
	const desiredDescription = hasDesiredDescription
		? (desiredDescriptionRaw as string | null)
		: (current.description ?? null);

	const hasDesiredInclude =
		desiredIncludeRaw !== undefined ||
		typeof desiredState.include_in_rename === 'boolean' ||
		typeof desiredState.include_in_rename === 'number' ||
		typeof desiredState.include_in_rename === 'string';
	const desiredInclude = hasDesiredInclude
		? resolveBoolean(desiredIncludeRaw, current.include_in_rename)
		: current.include_in_rename;

	const matches =
		normalizeText(current.name) === normalizeText(desiredName) &&
		normalizeText(current.description) === normalizeText(desiredDescription ?? '') &&
		current.include_in_rename === desiredInclude &&
		tagsEqual(currentTags, resolvedTags);

	if (matches) {
		return { success: true };
	}

	return updateGeneral({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			description: normalizeText(desiredDescription ?? ''),
			includeInRename: desiredInclude,
			tags: resolvedTags
		}
	});
}
