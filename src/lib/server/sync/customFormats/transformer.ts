/**
 * Custom Format Transformer
 * Transforms PCD custom format data to arr API format
 */

import type { PCDCache } from '$pcd/index.ts';
import {
	type SyncArrType,
	getSource,
	getResolution,
	getIndexerFlag,
	getQualityModifier,
	getReleaseType,
	getLanguage
} from '../mappings.ts';
import { sortConditions } from '$shared/pcd/conditions.ts';

const BYTES_PER_GB = 1024 * 1024 * 1024;
const SIZE_GB_DECIMALS = 2;

function bytesToGb(value: number | null): number {
	if (value == null) return 0;
	const factor = 10 ** SIZE_GB_DECIMALS;
	return Math.round((value / BYTES_PER_GB + Number.EPSILON) * factor) / factor;
}

// =============================================================================
// Arr API Types
// =============================================================================

export interface ArrCustomFormatSpecification {
	name: string;
	implementation: string;
	negate: boolean;
	required: boolean;
	fields: { name: string; value: unknown }[];
}

export interface ArrCustomFormat {
	id?: number;
	name: string;
	includeCustomFormatWhenRenaming?: boolean;
	specifications: ArrCustomFormatSpecification[];
}

// =============================================================================
// PCD Data Types
// =============================================================================

export interface PcdCustomFormat {
	id: number;
	name: string;
	includeInRename: boolean;
	conditions: PcdCondition[];
}

export interface PcdCondition {
	name: string;
	type: string;
	arrType: string; // 'radarr', 'sonarr', 'all'
	negate: boolean;
	required: boolean;
	// Type-specific data
	patterns?: { name: string; pattern: string }[];
	languages?: { name: string; except: boolean }[];
	sources?: string[];
	resolutions?: string[];
	qualityModifiers?: string[];
	releaseTypes?: string[];
	indexerFlags?: string[];
	size?: { minBytes: number | null; maxBytes: number | null };
	years?: { minYear: number | null; maxYear: number | null };
}

// =============================================================================
// Condition Type to Implementation Mapping
// =============================================================================

const CONDITION_IMPLEMENTATIONS: Record<string, string> = {
	release_title: 'ReleaseTitleSpecification',
	release_group: 'ReleaseGroupSpecification',
	edition: 'EditionSpecification',
	source: 'SourceSpecification',
	resolution: 'ResolutionSpecification',
	indexer_flag: 'IndexerFlagSpecification',
	quality_modifier: 'QualityModifierSpecification',
	size: 'SizeSpecification',
	language: 'LanguageSpecification',
	release_type: 'ReleaseTypeSpecification',
	year: 'YearSpecification'
};

// =============================================================================
// Transformer Functions
// =============================================================================

/**
 * Transform a single condition to arr API specification format
 * Returns null if the condition should be skipped for this arr type
 */
function transformCondition(
	condition: PcdCondition,
	arrType: SyncArrType
): ArrCustomFormatSpecification | null {
	// Skip conditions not applicable to this arr type
	if (condition.arrType !== 'all' && condition.arrType !== arrType) {
		return null;
	}

	// Quality modifier is Radarr-only
	if (condition.type === 'quality_modifier' && arrType === 'sonarr') {
		return null;
	}

	// Release type is Sonarr-only
	if (condition.type === 'release_type' && arrType === 'radarr') {
		return null;
	}

	const implementation = CONDITION_IMPLEMENTATIONS[condition.type];
	if (!implementation) {
		return null;
	}

	const spec: ArrCustomFormatSpecification = {
		name: condition.name,
		implementation,
		negate: condition.negate,
		required: condition.required,
		fields: []
	};

	// Build fields based on condition type
	switch (condition.type) {
		case 'release_title':
		case 'release_group':
		case 'edition': {
			// Pattern-based conditions use the regex pattern
			const pattern = condition.patterns?.[0]?.pattern;
			if (!pattern) return null;
			spec.fields = [{ name: 'value', value: pattern }];
			break;
		}

		case 'source': {
			const source = condition.sources?.[0];
			if (!source) return null;
			spec.fields = [{ name: 'value', value: getSource(source, arrType) }];
			break;
		}

		case 'resolution': {
			const resolution = condition.resolutions?.[0];
			if (!resolution) return null;
			spec.fields = [{ name: 'value', value: getResolution(resolution) }];
			break;
		}

		case 'indexer_flag': {
			const flag = condition.indexerFlags?.[0];
			if (!flag) return null;
			spec.fields = [{ name: 'value', value: getIndexerFlag(flag, arrType) }];
			break;
		}

		case 'quality_modifier': {
			const modifier = condition.qualityModifiers?.[0];
			if (!modifier) return null;
			spec.fields = [{ name: 'value', value: getQualityModifier(modifier) }];
			break;
		}

		case 'release_type': {
			const releaseType = condition.releaseTypes?.[0];
			if (!releaseType) return null;
			spec.fields = [{ name: 'value', value: getReleaseType(releaseType) }];
			break;
		}

		case 'size': {
			const size = condition.size;
			if (!size) return null;
			spec.fields = [
				{ name: 'min', value: bytesToGb(size.minBytes) },
				{ name: 'max', value: bytesToGb(size.maxBytes) }
			];
			break;
		}

		case 'year': {
			const years = condition.years;
			if (!years) return null;
			spec.fields = [
				{ name: 'min', value: years.minYear ?? 0 },
				{ name: 'max', value: years.maxYear ?? 0 }
			];
			break;
		}

		case 'language': {
			const lang = condition.languages?.[0];
			if (!lang) return null;
			const langData = getLanguage(lang.name, arrType);
			spec.fields = [{ name: 'value', value: langData.id }];
			// Add exceptLanguage field if present
			if (lang.except) {
				spec.fields.push({ name: 'exceptLanguage', value: true });
			}
			break;
		}

		default:
			return null;
	}

	return spec;
}

/**
 * Transform a PCD custom format to arr API format
 */
export function transformCustomFormat(
	format: PcdCustomFormat,
	arrType: SyncArrType
): ArrCustomFormat {
	const specifications: ArrCustomFormatSpecification[] = [];

	for (const condition of sortConditions(format.conditions)) {
		const spec = transformCondition(condition, arrType);
		if (spec) {
			specifications.push(spec);
		}
	}

	const result: ArrCustomFormat = {
		name: format.name,
		specifications
	};

	if (format.includeInRename) {
		result.includeCustomFormatWhenRenaming = true;
	}

	return result;
}

// =============================================================================
// PCD Query Functions
// =============================================================================

/**
 * Fetch a custom format from PCD cache with all conditions
 */
export async function fetchCustomFormatFromPcd(
	cache: PCDCache,
	formatName: string
): Promise<PcdCustomFormat | null> {
	const db = cache.kb;

	// Get custom format
	const format = await db
		.selectFrom('custom_formats')
		.select(['id', 'name', 'include_in_rename'])
		.where('name', '=', formatName)
		.executeTakeFirst();

	if (!format) return null;

	// Get conditions
	const conditions = await db
		.selectFrom('custom_format_conditions')
		.select(['name', 'type', 'arr_type', 'negate', 'required'])
		.where('custom_format_name', '=', formatName)
		.execute();

	if (conditions.length === 0) {
		return {
			id: format.id,
			name: format.name,
			includeInRename: format.include_in_rename === 1,
			conditions: []
		};
	}

	const conditionNames = conditions.map((c) => c.name);

	// Fetch all condition data in parallel using composite key
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
		db
			.selectFrom('condition_patterns as cp')
			.innerJoin('regular_expressions as re', 're.name', 'cp.regular_expression_name')
			.select(['cp.condition_name', 're.name', 're.pattern'])
			.where('cp.custom_format_name', '=', formatName)
			.where('cp.condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_languages as cl')
			.innerJoin('languages as l', 'l.name', 'cl.language_name')
			.select(['cl.condition_name', 'l.name', 'cl.except_language'])
			.where('cl.custom_format_name', '=', formatName)
			.where('cl.condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_sources')
			.select(['condition_name', 'source'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_resolutions')
			.select(['condition_name', 'resolution'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_quality_modifiers')
			.select(['condition_name', 'quality_modifier'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_release_types')
			.select(['condition_name', 'release_type'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_indexer_flags')
			.select(['condition_name', 'flag'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),
		db
			.selectFrom('condition_sizes')
			.select(['condition_name', 'min_bytes', 'max_bytes'])
			.where('custom_format_name', '=', formatName)
			.where('condition_name', 'in', conditionNames)
			.execute(),
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

	// Build conditions
	const pcdConditions: PcdCondition[] = conditions.map((c) => ({
		name: c.name,
		type: c.type,
		arrType: c.arr_type,
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

	return {
		id: format.id,
		name: format.name,
		includeInRename: format.include_in_rename === 1,
		conditions: pcdConditions
	};
}

/**
 * Fetch all custom formats from PCD cache
 * Used when syncing all formats referenced by quality profiles
 */
export async function fetchAllCustomFormatsFromPcd(cache: PCDCache): Promise<PcdCustomFormat[]> {
	const db = cache.kb;

	// Get all custom formats
	const formats = await db
		.selectFrom('custom_formats')
		.select(['id', 'name', 'include_in_rename'])
		.execute();

	if (formats.length === 0) return [];

	const formatNames = formats.map((f) => f.name);

	// Get all conditions
	const conditions = await db
		.selectFrom('custom_format_conditions')
		.select(['custom_format_name', 'name', 'type', 'arr_type', 'negate', 'required'])
		.where('custom_format_name', 'in', formatNames)
		.execute();

	// Build composite keys for all conditions
	const conditionKeys = conditions.map((c) => `${c.custom_format_name}|${c.name}`);

	// Fetch all condition data in parallel
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
	] =
		conditionKeys.length > 0
			? await Promise.all([
					db
						.selectFrom('condition_patterns as cp')
						.innerJoin('regular_expressions as re', 're.name', 'cp.regular_expression_name')
						.select(['cp.custom_format_name', 'cp.condition_name', 're.name', 're.pattern'])
						.where('cp.custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_languages as cl')
						.innerJoin('languages as l', 'l.name', 'cl.language_name')
						.select(['cl.custom_format_name', 'cl.condition_name', 'l.name', 'cl.except_language'])
						.where('cl.custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_sources')
						.select(['custom_format_name', 'condition_name', 'source'])
						.where('custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_resolutions')
						.select(['custom_format_name', 'condition_name', 'resolution'])
						.where('custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_quality_modifiers')
						.select(['custom_format_name', 'condition_name', 'quality_modifier'])
						.where('custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_release_types')
						.select(['custom_format_name', 'condition_name', 'release_type'])
						.where('custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_indexer_flags')
						.select(['custom_format_name', 'condition_name', 'flag'])
						.where('custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_sizes')
						.select(['custom_format_name', 'condition_name', 'min_bytes', 'max_bytes'])
						.where('custom_format_name', 'in', formatNames)
						.execute(),
					db
						.selectFrom('condition_years')
						.select(['custom_format_name', 'condition_name', 'min_year', 'max_year'])
						.where('custom_format_name', 'in', formatNames)
						.execute()
				])
			: [[], [], [], [], [], [], [], [], []];

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

	// Group conditions by format
	const conditionsByFormat = new Map<string, PcdCondition[]>();
	for (const c of conditions) {
		if (!conditionsByFormat.has(c.custom_format_name)) {
			conditionsByFormat.set(c.custom_format_name, []);
		}
		const key = `${c.custom_format_name}|${c.name}`;
		conditionsByFormat.get(c.custom_format_name)!.push({
			name: c.name,
			type: c.type,
			arrType: c.arr_type,
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

	// Build result
	return formats.map((f) => ({
		id: f.id,
		name: f.name,
		includeInRename: f.include_in_rename === 1,
		conditions: conditionsByFormat.get(f.name) || []
	}));
}
