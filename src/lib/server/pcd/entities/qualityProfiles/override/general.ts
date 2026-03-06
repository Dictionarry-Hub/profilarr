import { getCache } from '$pcd/index.ts';
import type { WriteResult } from '$pcd/index.ts';
import { general as readProfileGeneral } from '../general/read.ts';
import { updateGeneral } from '../general/update.ts';
import { create as createQualityProfile } from '../create.ts';
import type { StoredOpMetadata, StoredDesiredState } from '$pcd/conflicts/overrideUtils.ts';
import {
	getDesiredTo,
	normalizeTags,
	normalizeText,
	tagsEqual
} from '$pcd/conflicts/overrideUtils.ts';
import { resolveProfileName } from './resolve.ts';

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

function resolveLanguage(current: string | null, desiredState: StoredDesiredState): string | null {
	const langField = desiredState.language;
	if (!langField || typeof langField !== 'object') return current;
	const typed = langField as { from?: unknown; to?: unknown };
	if ('to' in typed) {
		return typeof typed.to === 'string' ? typed.to : null;
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

	const profileName = await resolveProfileName(cache, databaseId, metadata, desiredState);
	const fallbackName =
		metadata?.stable_key?.value ??
		metadata?.name ??
		getDesiredTo<string>(desiredState?.name) ??
		(typeof desiredState?.name === 'string' ? (desiredState.name as string) : null);

	if (!profileName && !fallbackName) {
		return { success: false, error: 'Quality profile not found for override' };
	}

	const profileRow = profileName
		? await cache.kb
				.selectFrom('quality_profiles')
				.select(['id', 'name'])
				.where('name', '=', profileName)
				.executeTakeFirst()
		: undefined;

	const desiredNameRaw =
		getDesiredTo<string>(desiredState.name) ??
		(typeof desiredState.name === 'string'
			? desiredState.name
			: (profileName ?? fallbackName ?? ''));
	const desiredDescriptionRaw =
		getDesiredTo<string | null>(desiredState.description) ??
		(typeof desiredState.description === 'string' || desiredState.description === null
			? (desiredState.description as string | null)
			: undefined);
	const desiredTags = resolveTags([], desiredState);
	const desiredLanguage = resolveLanguage(null, desiredState);

	// Entity was deleted upstream — re-create it with desired state
	if (!profileRow) {
		const createName = desiredNameRaw || fallbackName || profileName || '';
		if (!createName) {
			return { success: false, error: 'Quality profile not found for override' };
		}

		return createQualityProfile({
			databaseId,
			cache,
			layer: 'user',
			input: {
				name: createName,
				description: normalizeText((desiredDescriptionRaw ?? '') as string),
				tags: desiredTags,
				language: desiredLanguage
			}
		});
	}

	const current = await readProfileGeneral(cache, profileRow.id);
	if (!current) {
		return { success: false, error: 'Quality profile not found for override' };
	}

	const desiredName = desiredNameRaw || current.name;
	const desiredDescription =
		desiredDescriptionRaw !== undefined
			? (desiredDescriptionRaw as string | null)
			: current.description;
	const currentTags = current.tags.map((tag) => tag.name);
	const resolvedTags = resolveTags(currentTags, desiredState);
	const resolvedLanguage = resolveLanguage(current.language, desiredState);

	const matches =
		normalizeText(current.name) === normalizeText(desiredName) &&
		normalizeText(current.description) === normalizeText(desiredDescription ?? '') &&
		tagsEqual(currentTags, resolvedTags) &&
		current.language === resolvedLanguage;

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
			tags: resolvedTags,
			language: resolvedLanguage
		}
	});
}
