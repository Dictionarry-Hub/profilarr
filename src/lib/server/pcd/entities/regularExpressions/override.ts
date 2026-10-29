import { getCache } from '#pcd/index.ts';
import type { PCDCache, WriteResult } from '#pcd/index.ts';
import { get as getRegex } from './read.ts';
import { update } from './update.ts';
import type { StoredOpMetadata, StoredDesiredState } from '#pcd/conflicts/overrideUtils.ts';
import {
	getDesiredTo,
	followRenameChain,
	normalizeTags,
	normalizeText,
	tagsEqual
} from '#pcd/conflicts/overrideUtils.ts';

async function resolveRegexName(
	cache: PCDCache,
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<string | null> {
	const candidates = [
		metadata?.stable_key?.value,
		metadata?.name,
		getDesiredTo<string>(desiredState?.name),
		typeof desiredState?.name === 'string' ? (desiredState.name as string) : null
	].filter((v): v is string => typeof v === 'string' && v.length > 0);

	if (candidates.length === 0) return null;

	for (const name of candidates) {
		const row = await cache.kb
			.selectFrom('regular_expressions')
			.select('name')
			.where('name', '=', name)
			.executeTakeFirst();
		if (row) return row.name;
	}

	const resolved = followRenameChain(databaseId, 'regular_expression', candidates[0]);
	if (resolved !== candidates[0]) {
		const row = await cache.kb
			.selectFrom('regular_expressions')
			.select('name')
			.where('name', '=', resolved)
			.executeTakeFirst();
		if (row) return row.name;
	}

	return null;
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

async function overrideRegex(
	databaseId: number,
	metadata: StoredOpMetadata | null,
	desiredState: StoredDesiredState | null
): Promise<WriteResult> {
	if (!desiredState) {
		return { success: false, error: 'Missing desired state for regex override' };
	}

	const cache = getCache(databaseId);
	if (!cache) {
		return { success: false, error: 'Cache not available' };
	}

	const regexName = await resolveRegexName(cache, databaseId, metadata, desiredState);
	if (!regexName) {
		return { success: false, error: 'Regular expression not found for override' };
	}

	const regexRow = await cache.kb
		.selectFrom('regular_expressions')
		.select(['id', 'name'])
		.where('name', '=', regexName)
		.executeTakeFirst();
	if (!regexRow) {
		return { success: false, error: 'Regular expression not found for override' };
	}

	const current = await getRegex(cache, regexRow.id);
	if (!current) {
		return { success: false, error: 'Regular expression not found for override' };
	}

	const desiredName =
		getDesiredTo<string>(desiredState.name) ??
		(typeof desiredState.name === 'string' ? (desiredState.name as string) : current.name);
	const desiredPattern =
		getDesiredTo<string>(desiredState.pattern) ??
		(typeof desiredState.pattern === 'string' ? (desiredState.pattern as string) : current.pattern);
	const desiredDescription =
		getDesiredTo<string | null>(desiredState.description) ??
		(typeof desiredState.description === 'string' || desiredState.description === null
			? (desiredState.description as string | null)
			: current.description);
	const desiredRegex101Id =
		getDesiredTo<string | null>(desiredState.regex101_id) ??
		(typeof desiredState.regex101_id === 'string' || desiredState.regex101_id === null
			? (desiredState.regex101_id as string | null)
			: current.regex101_id);
	const currentTags = current.tags.map((tag) => tag.name);
	const desiredTags = resolveTags(currentTags, desiredState);

	const matches =
		normalizeText(current.name) === normalizeText(desiredName) &&
		normalizeText(current.pattern) === normalizeText(desiredPattern) &&
		normalizeText(current.description) === normalizeText(desiredDescription ?? '') &&
		normalizeText(current.regex101_id) === normalizeText(desiredRegex101Id ?? '') &&
		tagsEqual(currentTags, desiredTags);

	if (matches) {
		return { success: true };
	}

	return update({
		databaseId,
		cache,
		layer: 'user',
		current,
		input: {
			name: desiredName,
			pattern: desiredPattern,
			tags: desiredTags,
			description: desiredDescription,
			regex101Id: desiredRegex101Id
		}
	});
}

export { overrideRegex as overrideCreate, overrideRegex as overrideUpdate };
