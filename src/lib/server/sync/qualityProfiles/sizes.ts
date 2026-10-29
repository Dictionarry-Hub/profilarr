/**
 * Quality size limits on profile items.
 *
 * Sonarr v5 stores min, max and preferred size (MB per minute of runtime) on
 * each quality item of a profile instead of in the global quality
 * definitions. These helpers read sizes off a fetched profile, build a map
 * from PCD definitions, and write a map onto an outgoing payload. They know
 * nothing about versions; callers decide whether to use them.
 */

import type { ArrQualityProfileItem, ArrQualityProfileReadItem } from '#arr/types.ts';
import type {
	MappedQualityDefinition,
	QualityDefinitionManagedFields
} from '#server/sync/mediaManagement/transformer.ts';

export type QualitySizes = QualityDefinitionManagedFields;

/** Sizes keyed by lowercase API quality name (e.g. "webdl-1080p"). */
export type QualitySizeMap = Map<string, QualitySizes>;

function sizeKey(name: string): string {
	return name.toLowerCase();
}

/**
 * Sizes currently on a fetched profile, group members included. Every
 * quality row is recorded; a missing key means null, because Sonarr leaves
 * null fields out of its JSON.
 */
export function collectItemSizes(items: ArrQualityProfileReadItem[] | undefined): QualitySizeMap {
	const sizes: QualitySizeMap = new Map();
	for (const item of items ?? []) {
		if (item.quality) {
			sizes.set(sizeKey(item.quality.name), {
				minSize: item.minSize ?? null,
				maxSize: item.maxSize ?? null,
				preferredSize: item.preferredSize ?? null
			});
		}
		if (item.items?.length) {
			for (const [name, value] of collectItemSizes(item.items)) sizes.set(name, value);
		}
	}
	return sizes;
}

/**
 * Write sizes onto the quality rows of an outgoing payload, recursing into
 * groups. Group rows themselves carry no sizes (Sonarr reads the member).
 * Qualities absent from the map are left untouched.
 *
 * @returns how many quality rows received sizes
 */
export function applySizesToItems(items: ArrQualityProfileItem[], sizes: QualitySizeMap): number {
	let applied = 0;
	for (const item of items) {
		if (item.quality) {
			const value = sizes.get(sizeKey(item.quality.name));
			if (value) {
				item.minSize = value.minSize;
				item.maxSize = value.maxSize;
				item.preferredSize = value.preferredSize;
				applied++;
			}
		}
		if (item.items.length > 0) applied += applySizesToItems(item.items, sizes);
	}
	return applied;
}

/** `override` wins per quality; qualities only in `fallback` keep their values. */
export function mergeSizes(fallback: QualitySizeMap, override: QualitySizeMap): QualitySizeMap {
	return new Map([...fallback, ...override]);
}

/**
 * The sizes definitions set for one profile, first match per quality wins:
 * the profile's own definitions config, then the instance's selection.
 * Qualities neither covers are absent; Profilarr does not manage them.
 */
export function resolveDefinitionSizes(input: {
	global?: QualitySizeMap | null;
	override?: QualitySizeMap | null;
}): QualitySizeMap {
	return mergeSizes(input.global ?? new Map(), input.override ?? new Map());
}

/**
 * One profile's sizes, first match per quality wins: the profile's own
 * definitions config, then the instance's selection, then what the Arr
 * already has (or its schema defaults for a new profile).
 */
export function resolveProfileSizes(input: {
	fallback: QualitySizeMap;
	global?: QualitySizeMap | null;
	override?: QualitySizeMap | null;
}): QualitySizeMap {
	return mergeSizes(input.fallback, resolveDefinitionSizes(input));
}

/** From `transformQualityDefinitionsForArr` output, which already maps PCD 0 to null. */
export function definitionsToSizeMap(definitions: MappedQualityDefinition[]): QualitySizeMap {
	const sizes: QualitySizeMap = new Map();
	for (const definition of definitions) {
		sizes.set(sizeKey(definition.qualityName), { ...definition.fields });
	}
	return sizes;
}
