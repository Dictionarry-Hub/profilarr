/**
 * Custom format condition read queries for test evaluation
 */

import { sql } from 'kysely';
import type { PCDCache } from '$pcd/index.ts';
import type {
	ConditionData,
	ConditionListItem,
	CustomFormatWithConditions
} from '$shared/pcd/display.ts';

/**
 * Get all conditions for a custom format with full data for evaluation
 */
export async function getConditionsForEvaluation(
	cache: PCDCache,
	formatName: string
): Promise<ConditionData[]> {
	const db = cache.kb;

	// Get base conditions
	const conditions = await db
		.selectFrom('custom_format_conditions')
		.select(['custom_format_name', 'name', 'type', 'arr_type', 'negate', 'required'])
		.where('custom_format_name', '=', formatName)
		.execute();

	if (conditions.length === 0) return [];

	const conditionNames = conditions.map((c) => c.name);

	// Get all related data in parallel
	const [
		patterns,
		languages,
		sources,
		resolutions,
		qualityModifiers,
		releaseTypes,
		indexerFlags,
		sizes,
		years
	] = await Promise.all([
		// Patterns with regex
		db
			.selectFrom('condition_patterns as cp')
			.innerJoin('regular_expressions as re', 're.name', 'cp.regular_expression_name')
			.select(['cp.condition_name', 're.name', 're.pattern'])
			.where('cp.custom_format_name', '=', formatName)
			.where('cp.condition_name', 'in', conditionNames)
			.execute(),

		// Languages
		db
			.selectFrom('condition_languages as cl')
			.innerJoin('languages as l', 'l.name', 'cl.language_name')
			.select(['cl.condition_name', 'l.name', 'cl.except_language'])
			.where('cl.custom_format_name', '=', formatName)
			.where('cl.condition_name', 'in', conditionNames)
			.execute(),

		// Sources
		db
			.selectFrom('condition_sources')
			.select(['condition_name', 'source'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),

		// Resolutions
		db
			.selectFrom('condition_resolutions')
			.select(['condition_name', 'resolution'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),

		// Quality modifiers
		db
			.selectFrom('condition_quality_modifiers')
			.select(['condition_name', 'quality_modifier'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),

		// Release types
		db
			.selectFrom('condition_release_types')
			.select(['condition_name', 'release_type'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),

		// Indexer flags
		db
			.selectFrom('condition_indexer_flags')
			.select(['condition_name', 'flag'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),

		// Sizes
		db
			.selectFrom('condition_sizes')
			.select(['condition_name', 'min_bytes', 'max_bytes'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),

		// Years
		db
			.selectFrom('condition_years')
			.select(['condition_name', 'min_year', 'max_year'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute()
	]);

	// Build lookup maps using condition_name as key
	const patternsMap = new Map<string, { name: string; pattern: string }[]>();
	for (const p of patterns) {
		if (!patternsMap.has(p.condition_name)) {
			patternsMap.set(p.condition_name, []);
		}
		patternsMap.get(p.condition_name)!.push({ name: p.name, pattern: p.pattern });
	}

	const languagesMap = new Map<string, { name: string; except: boolean }[]>();
	for (const l of languages) {
		if (!languagesMap.has(l.condition_name)) {
			languagesMap.set(l.condition_name, []);
		}
		languagesMap.get(l.condition_name)!.push({
			name: l.name,
			except: l.except_language === 1
		});
	}

	const sourcesMap = new Map<string, string[]>();
	for (const s of sources) {
		if (!sourcesMap.has(s.condition_name)) {
			sourcesMap.set(s.condition_name, []);
		}
		sourcesMap.get(s.condition_name)!.push(s.source);
	}

	const resolutionsMap = new Map<string, string[]>();
	for (const r of resolutions) {
		if (!resolutionsMap.has(r.condition_name)) {
			resolutionsMap.set(r.condition_name, []);
		}
		resolutionsMap.get(r.condition_name)!.push(r.resolution);
	}

	const qualityModifiersMap = new Map<string, string[]>();
	for (const q of qualityModifiers) {
		if (!qualityModifiersMap.has(q.condition_name)) {
			qualityModifiersMap.set(q.condition_name, []);
		}
		qualityModifiersMap.get(q.condition_name)!.push(q.quality_modifier);
	}

	const releaseTypesMap = new Map<string, string[]>();
	for (const r of releaseTypes) {
		if (!releaseTypesMap.has(r.condition_name)) {
			releaseTypesMap.set(r.condition_name, []);
		}
		releaseTypesMap.get(r.condition_name)!.push(r.release_type);
	}

	const indexerFlagsMap = new Map<string, string[]>();
	for (const f of indexerFlags) {
		if (!indexerFlagsMap.has(f.condition_name)) {
			indexerFlagsMap.set(f.condition_name, []);
		}
		indexerFlagsMap.get(f.condition_name)!.push(f.flag);
	}

	const sizesMap = new Map<string, { minBytes: number | null; maxBytes: number | null }>();
	for (const s of sizes) {
		sizesMap.set(s.condition_name, {
			minBytes: s.min_bytes,
			maxBytes: s.max_bytes
		});
	}

	const yearsMap = new Map<string, { minYear: number | null; maxYear: number | null }>();
	for (const y of years) {
		yearsMap.set(y.condition_name, {
			minYear: y.min_year,
			maxYear: y.max_year
		});
	}

	// Build final result
	return conditions.map((c) => ({
		name: c.name,
		type: c.type,
		arrType: c.arr_type as 'all' | 'radarr' | 'sonarr',
		negate: c.negate === 1,
		required: c.required === 1,
		patterns: patternsMap.get(c.name),
		languages: languagesMap.get(c.name),
		sources: sourcesMap.get(c.name),
		resolutions: resolutionsMap.get(c.name),
		qualityModifiers: qualityModifiersMap.get(c.name),
		releaseTypes: releaseTypesMap.get(c.name),
		indexerFlags: indexerFlagsMap.get(c.name),
		size: sizesMap.get(c.name),
		years: yearsMap.get(c.name)
	}));
}

/**
 * Get all custom formats with their conditions for batch evaluation
 * Optimized to fetch all data in minimal queries
 */
export async function getAllConditionsForEvaluation(
	cache: PCDCache
): Promise<CustomFormatWithConditions[]> {
	const db = cache.kb;

	// Get all custom formats
	const formats = await db
		.selectFrom('custom_formats')
		.select(['id', 'name'])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	if (formats.length === 0) return [];

	// Get all conditions for all formats
	const conditions = await db
		.selectFrom('custom_format_conditions')
		.select(['custom_format_name', 'name', 'type', 'arr_type', 'negate', 'required'])
		.execute();

	if (conditions.length === 0) {
		return formats.map((f) => ({ name: f.name, conditions: [] }));
	}

	// Get all related data in parallel
	const [
		patterns,
		languages,
		sources,
		resolutions,
		qualityModifiers,
		releaseTypes,
		indexerFlags,
		sizes,
		years
	] = await Promise.all([
		// Patterns with regex
		db
			.selectFrom('condition_patterns as cp')
			.innerJoin('regular_expressions as re', 're.name', 'cp.regular_expression_name')
			.select(['cp.custom_format_name', 'cp.condition_name', 're.name', 're.pattern'])
			.execute(),

		// Languages
		db
			.selectFrom('condition_languages as cl')
			.innerJoin('languages as l', 'l.name', 'cl.language_name')
			.select(['cl.custom_format_name', 'cl.condition_name', 'l.name', 'cl.except_language'])
			.execute(),

		// Sources
		db
			.selectFrom('condition_sources')
			.select(['custom_format_name', 'condition_name', 'source'])
			.execute(),

		// Resolutions
		db
			.selectFrom('condition_resolutions')
			.select(['custom_format_name', 'condition_name', 'resolution'])
			.execute(),

		// Quality modifiers
		db
			.selectFrom('condition_quality_modifiers')
			.select(['custom_format_name', 'condition_name', 'quality_modifier'])
			.execute(),

		// Release types
		db
			.selectFrom('condition_release_types')
			.select(['custom_format_name', 'condition_name', 'release_type'])
			.execute(),

		// Indexer flags
		db
			.selectFrom('condition_indexer_flags')
			.select(['custom_format_name', 'condition_name', 'flag'])
			.execute(),

		// Sizes
		db
			.selectFrom('condition_sizes')
			.select(['custom_format_name', 'condition_name', 'min_bytes', 'max_bytes'])
			.execute(),

		// Years
		db
			.selectFrom('condition_years')
			.select(['custom_format_name', 'condition_name', 'min_year', 'max_year'])
			.execute()
	]);

	// Build lookup maps using composite key (custom_format_name|condition_name)
	const patternsMap = new Map<string, { name: string; pattern: string }[]>();
	for (const p of patterns) {
		const key = `${p.custom_format_name}|${p.condition_name}`;
		if (!patternsMap.has(key)) {
			patternsMap.set(key, []);
		}
		patternsMap.get(key)!.push({ name: p.name, pattern: p.pattern });
	}

	const languagesMap = new Map<string, { name: string; except: boolean }[]>();
	for (const l of languages) {
		const key = `${l.custom_format_name}|${l.condition_name}`;
		if (!languagesMap.has(key)) {
			languagesMap.set(key, []);
		}
		languagesMap.get(key)!.push({
			name: l.name,
			except: l.except_language === 1
		});
	}

	const sourcesMap = new Map<string, string[]>();
	for (const s of sources) {
		const key = `${s.custom_format_name}|${s.condition_name}`;
		if (!sourcesMap.has(key)) {
			sourcesMap.set(key, []);
		}
		sourcesMap.get(key)!.push(s.source);
	}

	const resolutionsMap = new Map<string, string[]>();
	for (const r of resolutions) {
		const key = `${r.custom_format_name}|${r.condition_name}`;
		if (!resolutionsMap.has(key)) {
			resolutionsMap.set(key, []);
		}
		resolutionsMap.get(key)!.push(r.resolution);
	}

	const qualityModifiersMap = new Map<string, string[]>();
	for (const q of qualityModifiers) {
		const key = `${q.custom_format_name}|${q.condition_name}`;
		if (!qualityModifiersMap.has(key)) {
			qualityModifiersMap.set(key, []);
		}
		qualityModifiersMap.get(key)!.push(q.quality_modifier);
	}

	const releaseTypesMap = new Map<string, string[]>();
	for (const r of releaseTypes) {
		const key = `${r.custom_format_name}|${r.condition_name}`;
		if (!releaseTypesMap.has(key)) {
			releaseTypesMap.set(key, []);
		}
		releaseTypesMap.get(key)!.push(r.release_type);
	}

	const indexerFlagsMap = new Map<string, string[]>();
	for (const f of indexerFlags) {
		const key = `${f.custom_format_name}|${f.condition_name}`;
		if (!indexerFlagsMap.has(key)) {
			indexerFlagsMap.set(key, []);
		}
		indexerFlagsMap.get(key)!.push(f.flag);
	}

	const sizesMap = new Map<string, { minBytes: number | null; maxBytes: number | null }>();
	for (const s of sizes) {
		const key = `${s.custom_format_name}|${s.condition_name}`;
		sizesMap.set(key, {
			minBytes: s.min_bytes,
			maxBytes: s.max_bytes
		});
	}

	const yearsMap = new Map<string, { minYear: number | null; maxYear: number | null }>();
	for (const y of years) {
		const key = `${y.custom_format_name}|${y.condition_name}`;
		yearsMap.set(key, {
			minYear: y.min_year,
			maxYear: y.max_year
		});
	}

	// Build conditions by format
	const conditionsByFormat = new Map<string, ConditionData[]>();
	for (const c of conditions) {
		if (!conditionsByFormat.has(c.custom_format_name)) {
			conditionsByFormat.set(c.custom_format_name, []);
		}
		const key = `${c.custom_format_name}|${c.name}`;
		conditionsByFormat.get(c.custom_format_name)!.push({
			name: c.name,
			type: c.type,
			arrType: c.arr_type as 'all' | 'radarr' | 'sonarr',
			negate: c.negate === 1,
			required: c.required === 1,
			patterns: patternsMap.get(key),
			languages: languagesMap.get(key),
			sources: sourcesMap.get(key),
			resolutions: resolutionsMap.get(key),
			qualityModifiers: qualityModifiersMap.get(key),
			releaseTypes: releaseTypesMap.get(key),
			indexerFlags: indexerFlagsMap.get(key),
			size: sizesMap.get(key),
			years: yearsMap.get(key)
		});
	}

	// Build final result
	return formats.map((f) => ({
		name: f.name,
		conditions: conditionsByFormat.get(f.name) || []
	}));
}

/**
 * Get all conditions for a custom format (basic info for list display)
 */
export async function listConditions(
	cache: PCDCache,
	formatName: string
): Promise<ConditionListItem[]> {
	const db = cache.kb;

	const conditions = await db
		.selectFrom('custom_format_conditions')
		.select(['name', 'type', 'negate', 'required'])
		.where('custom_format_name', '=', formatName)
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	return conditions.map((c) => ({
		name: c.name,
		type: c.type,
		negate: c.negate === 1,
		required: c.required === 1
	}));
}
