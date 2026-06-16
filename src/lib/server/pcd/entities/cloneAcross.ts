/**
 * Cross-Database Entity Clone
 *
 * Clones an entity from one database to another, resolving dependencies
 * in waterfall order. Handles name conflicts by renaming.
 *
 * Dependency order for quality_profile:
 *   regular_expressions → custom_formats → quality_profile
 *
 * Dependency order for custom_format:
 *   regular_expressions → custom_format
 */

import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import { recompileCache } from '$pcd/index.ts';
import { ConflictError } from '$pcd/core/errors.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import type { PCDCache } from '$pcd/database/cache.ts';
import type {
	EntityType,
	PortableCustomFormat,
	PortableRegularExpression
} from '$shared/pcd/portable.ts';
import type { OrderedItem } from '$shared/pcd/display.ts';
import { PATTERN_TYPES } from '$shared/pcd/conditions.ts';
import * as serialize from './serialize.ts';
import * as deserialize from './deserialize.ts';
import * as regexQueries from './regularExpressions/index.ts';
import * as cfQueries from './customFormats/index.ts';
import * as qpQueries from './qualityProfiles/index.ts';

// ============================================================================
// Types
// ============================================================================

interface CloneAcrossOptions {
	sourceDatabaseId: number;
	targetDatabaseId: number;
	entityType: EntityType;
	sourceName: string;
	newName?: string;
}

type GenericEntityType = Exclude<EntityType, 'quality_profile' | 'custom_format'>;

// ============================================================================
// Internals
// ============================================================================

function isPatternCondition(condition: { type: string }): boolean {
	return (PATTERN_TYPES as readonly string[]).includes(condition.type);
}

async function batchExistingNames(
	cache: PCDCache,
	table: 'regular_expressions' | 'custom_formats' | 'quality_profiles',
	names: string[]
): Promise<Set<string>> {
	if (names.length === 0) return new Set();
	const rows = await cache.kb
		.selectFrom(table)
		.select('name')
		.where((eb) =>
			eb(
				eb.fn('lower', [eb.ref('name')]),
				'in',
				names.map((n) => n.toLowerCase())
			)
		)
		.execute();
	return new Set(rows.map((r) => r.name.toLowerCase()));
}

function resolveCloneContext(options: CloneAcrossOptions) {
	const { sourceDatabaseId, targetDatabaseId, sourceName, newName } = options;
	const sourceCache = pcdManager.getCache(sourceDatabaseId);
	const targetCache = pcdManager.getCache(targetDatabaseId);
	if (!sourceCache) throw new Error(`Source database cache (${sourceDatabaseId}) not available`);
	if (!targetCache) throw new Error(`Target database cache (${targetDatabaseId}) not available`);
	const layer: OperationLayer = canWriteToBase(targetDatabaseId) ? 'base' : 'user';
	const targetName = newName || sourceName;
	return { sourceCache, targetCache, layer, targetName };
}

function freshTargetCache(targetDatabaseId: number): PCDCache {
	const cache = pcdManager.getCache(targetDatabaseId);
	if (!cache) throw new Error(`Target database cache (${targetDatabaseId}) not available`);
	return cache;
}

function tagsEqual(a: string[], b: string[]): boolean {
	if (a.length !== b.length) return false;
	const sa = [...a].sort();
	const sb = [...b].sort();
	return sa.every((v, i) => v === sb[i]);
}

function regexContentMatches(
	source: PortableRegularExpression,
	target: PortableRegularExpression
): boolean {
	return (
		source.pattern === target.pattern &&
		source.description === target.description &&
		source.regex101Id === target.regex101Id &&
		tagsEqual(source.tags, target.tags)
	);
}

type AnyCondition = PortableCustomFormat['conditions'][number];

function canonicalizeCondition(c: AnyCondition): AnyCondition {
	return {
		...c,
		// Normalize arrType: NULL in the source DB is written as 'all' in the target (via ?? 'all').
		// Use || to treat null, undefined, and '' all as 'all' for comparison purposes.
		arrType: (c.arrType || 'all') as AnyCondition['arrType'],
		patterns: c.patterns
			? [...c.patterns].sort((a, b) => a.name.localeCompare(b.name))
			: c.patterns,
		languages: c.languages
			? [...c.languages].sort((a, b) => a.name.localeCompare(b.name))
			: c.languages,
		sources: c.sources ? [...c.sources].sort() : c.sources,
		resolutions: c.resolutions ? [...c.resolutions].sort() : c.resolutions,
		qualityModifiers: c.qualityModifiers ? [...c.qualityModifiers].sort() : c.qualityModifiers,
		releaseTypes: c.releaseTypes ? [...c.releaseTypes].sort() : c.releaseTypes,
		indexerFlags: c.indexerFlags ? [...c.indexerFlags].sort() : c.indexerFlags
	};
}

function canonicalizeConditions(conditions: AnyCondition[]): AnyCondition[] {
	return [...conditions].sort((a, b) => a.name.localeCompare(b.name)).map(canonicalizeCondition);
}

function normalizeTestDescription(
	t: PortableCustomFormat['tests'][number]
): PortableCustomFormat['tests'][number] {
	// createTest uses a truthy check: `description ? 'value' : NULL`, so '' → NULL in the target DB.
	// Normalize '' to null so source '' compares equal to target null.
	return { ...t, description: t.description || null };
}

function cfContentMatches(source: PortableCustomFormat, target: PortableCustomFormat): boolean {
	// source has already had regex renames applied before this check.
	// Canonicalize order before stringifying — DB insertion order may differ between databases.
	const srcConds = JSON.stringify(canonicalizeConditions(source.conditions));
	const tgtConds = JSON.stringify(canonicalizeConditions(target.conditions));
	const srcTests = JSON.stringify(source.tests.map(normalizeTestDescription));
	const tgtTests = JSON.stringify(target.tests.map(normalizeTestDescription));
	return (
		(source.description?.trim() || null) === (target.description?.trim() || null) &&
		source.includeInRename === target.includeInRename &&
		tagsEqual(source.tags, target.tags) &&
		srcConds === tgtConds &&
		srcTests === tgtTests
	);
}

/**
 * Resolves where a dep should land in the target database.
 * Same content → reuse (skipWrite). Different content → next free numeric slot "(2)", "(3)", …
 */
async function resolveDep<T>(
	sourceName: string,
	sourcePortable: T,
	targetCache: PCDCache,
	existingLower: Set<string>,
	table: 'regular_expressions' | 'custom_formats',
	serializeFn: (cache: PCDCache, name: string) => Promise<T>,
	matchFn: (a: T, b: T) => boolean,
	entityLabel: string,
	reservedNames: Set<string> = new Set()
): Promise<{ targetName: string; skipWrite: boolean }> {
	const lowerName = sourceName.toLowerCase();
	const inDb = existingLower.has(lowerName);
	const reserved = reservedNames.has(lowerName);

	if (!inDb && !reserved) {
		return { targetName: sourceName, skipWrite: false };
	}

	if (inDb) {
		const existing = await serializeFn(targetCache, sourceName);
		if (matchFn(sourcePortable, existing)) {
			return { targetName: sourceName, skipWrite: true };
		}
	}

	for (let n = 2; n <= 99; n++) {
		const candidate = `${sourceName} (${n})`;
		const lowerCandidate = candidate.toLowerCase();

		if (reservedNames.has(lowerCandidate)) continue;

		const candidateRow = await targetCache.kb
			.selectFrom(table)
			.select('name')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', lowerCandidate))
			.executeTakeFirst();

		if (!candidateRow) return { targetName: candidate, skipWrite: false };

		const existingCandidate = await serializeFn(targetCache, candidateRow.name);
		if (matchFn(sourcePortable, existingCandidate)) {
			return { targetName: candidateRow.name, skipWrite: true };
		}
	}

	throw new ConflictError(
		`Cannot clone ${entityLabel} "${sourceName}": too many conflicting variants already exist in the target database.`
	);
}

/** Clones regex dependencies from all given CF portables. Returns a rename map (only entries where name changed). */
async function cloneRegexDeps(
	targetDatabaseId: number,
	sourceCache: PCDCache,
	targetCache: PCDCache,
	layer: OperationLayer,
	cfPortables: PortableCustomFormat[]
): Promise<Map<string, string>> {
	const allRegexNames = new Set<string>();
	for (const cfPortable of cfPortables) {
		for (const condition of cfPortable.conditions) {
			if (!isPatternCondition(condition)) continue;
			for (const pattern of condition.patterns ?? []) {
				allRegexNames.add(pattern.name);
			}
		}
	}

	if (allRegexNames.size === 0) return new Map();

	const existingInTarget = await batchExistingNames(targetCache, 'regular_expressions', [
		...allRegexNames
	]);

	const regexNames = [...allRegexNames];
	const regexPortables = await Promise.all(
		regexNames.map((name) => serialize.serializeRegularExpression(sourceCache, name))
	);

	const regexRenameMap = new Map<string, string>();
	const toWrite: Array<PortableRegularExpression> = [];
	const reservedRegexNames = new Set<string>();

	for (let i = 0; i < regexNames.length; i++) {
		const sourceName = regexNames[i];
		const { targetName, skipWrite } = await resolveDep(
			sourceName,
			regexPortables[i],
			targetCache,
			existingInTarget,
			'regular_expressions',
			serialize.serializeRegularExpression,
			regexContentMatches,
			'regular expression',
			reservedRegexNames
		);

		reservedRegexNames.add(targetName.toLowerCase());
		if (targetName !== sourceName) regexRenameMap.set(sourceName, targetName);

		if (!skipWrite) {
			toWrite.push({ ...regexPortables[i], name: targetName });
		}
	}

	if (toWrite.length === 0) return regexRenameMap;

	// Write all new regex with skipRecompile — single cache stays valid, one recompile at end
	const cache = freshTargetCache(targetDatabaseId);
	for (const portable of toWrite) {
		await regexQueries.create({
			databaseId: targetDatabaseId,
			cache,
			layer,
			input: portable,
			skipRecompile: true
		});
	}
	await recompileCache(targetDatabaseId);
	return regexRenameMap;
}

function applyRegexRenames(
	cfPortable: PortableCustomFormat,
	regexRenameMap: Map<string, string>
): void {
	if (regexRenameMap.size === 0) return;
	for (const condition of cfPortable.conditions) {
		if (!isPatternCondition(condition)) continue;
		for (const pattern of condition.patterns ?? []) {
			const renamed = regexRenameMap.get(pattern.name);
			if (renamed) pattern.name = renamed;
		}
	}
}

function filterQualityItemsForTarget(
	items: OrderedItem[],
	validQualityNames: Set<string>
): OrderedItem[] {
	return items
		.filter((item) => {
			if (item.type === 'quality') return validQualityNames.has(item.name.toLowerCase());
			if (item.type === 'group') {
				const validMembers = (item.members ?? []).filter((m) =>
					validQualityNames.has(m.name.toLowerCase())
				);
				return validMembers.length > 0;
			}
			return true;
		})
		.map((item) => {
			if (item.type !== 'group') return item;
			const validMembers = (item.members ?? []).filter((m) =>
				validQualityNames.has(m.name.toLowerCase())
			);
			return { ...item, members: validMembers };
		});
}

const ENTITY_TABLE: Record<GenericEntityType, string> = {
	delay_profile: 'delay_profiles',
	regular_expression: 'regular_expressions',
	radarr_naming: 'radarr_naming',
	sonarr_naming: 'sonarr_naming',
	radarr_media_settings: 'radarr_media_settings',
	sonarr_media_settings: 'sonarr_media_settings',
	radarr_quality_definitions: 'radarr_quality_definitions',
	sonarr_quality_definitions: 'sonarr_quality_definitions'
};

const ENTITY_FNS: Record<
	GenericEntityType,
	{
		serializeFn: (cache: PCDCache, name: string) => Promise<{ name: string }>;
		deserializeFn: (opts: {
			databaseId: number;
			cache: PCDCache;
			layer: OperationLayer;
			portable: never;
		}) => Promise<unknown>;
	}
> = {
	delay_profile: {
		serializeFn: serialize.serializeDelayProfile,
		deserializeFn: deserialize.deserializeDelayProfile
	},
	regular_expression: {
		serializeFn: serialize.serializeRegularExpression,
		deserializeFn: deserialize.deserializeRegularExpression
	},
	radarr_naming: {
		serializeFn: serialize.serializeRadarrNaming,
		deserializeFn: deserialize.deserializeRadarrNaming
	},
	sonarr_naming: {
		serializeFn: serialize.serializeSonarrNaming,
		deserializeFn: deserialize.deserializeSonarrNaming
	},
	radarr_media_settings: {
		serializeFn: serialize.serializeRadarrMediaSettings,
		deserializeFn: deserialize.deserializeRadarrMediaSettings
	},
	sonarr_media_settings: {
		serializeFn: serialize.serializeSonarrMediaSettings,
		deserializeFn: deserialize.deserializeSonarrMediaSettings
	},
	radarr_quality_definitions: {
		serializeFn: serialize.serializeRadarrQualityDefinitions,
		deserializeFn: deserialize.deserializeRadarrQualityDefinitions
	},
	sonarr_quality_definitions: {
		serializeFn: serialize.serializeSonarrQualityDefinitions,
		deserializeFn: deserialize.deserializeSonarrQualityDefinitions
	}
};

// ============================================================================
// Exports
// ============================================================================

/** Clones a custom format across databases, pre-flight checking the CF name before writing any regex dependencies. */
export async function cloneCustomFormatAcross(options: CloneAcrossOptions) {
	const { targetDatabaseId } = options;
	const { sourceCache, targetCache, layer, targetName } = resolveCloneContext(options);

	// Pre-flight: check CF name before writing any dependencies
	const existingCf = await batchExistingNames(targetCache, 'custom_formats', [targetName]);
	if (existingCf.has(targetName.toLowerCase())) {
		throw new ConflictError(`Custom format "${targetName}" already exists in the target database.`);
	}

	const cfPortable = await serialize.serializeCustomFormat(sourceCache, options.sourceName);
	const regexRenameMap = await cloneRegexDeps(targetDatabaseId, sourceCache, targetCache, layer, [
		cfPortable
	]);
	applyRegexRenames(cfPortable, regexRenameMap);
	cfPortable.name = targetName;

	// Get cache after regex recompile (or fresh if no regex were written)
	const cache = freshTargetCache(targetDatabaseId);

	// CF structure — skipRecompile keeps cache valid
	const createResult = await cfQueries.create({
		databaseId: targetDatabaseId,
		cache,
		layer,
		input: {
			name: cfPortable.name,
			description: cfPortable.description,
			includeInRename: cfPortable.includeInRename,
			tags: cfPortable.tags
		},
		skipRecompile: true
	});

	if (!createResult.success) {
		throw new Error(createResult.error ?? 'Failed to create custom format');
	}

	// Conditions
	if (cfPortable.conditions.length > 0) {
		await cfQueries.updateConditions({
			databaseId: targetDatabaseId,
			cache,
			layer,
			formatName: cfPortable.name,
			originalConditions: [],
			conditions: cfPortable.conditions,
			skipRecompile: true
		});
	}

	// Tests
	for (const test of cfPortable.tests) {
		await cfQueries.createTest({
			databaseId: targetDatabaseId,
			layer,
			formatName: cfPortable.name,
			skipRecompile: true,
			input: {
				title: test.title,
				type: test.type,
				should_match: test.shouldMatch,
				description: test.description
			}
		});
	}

	// Single recompile for all CF writes
	await recompileCache(targetDatabaseId);
	return createResult;
}

/** Clones a quality profile across databases, resolving the full dependency tree: regular_expressions → custom_formats → quality_profile. */
export async function cloneQualityProfileAcross(options: CloneAcrossOptions) {
	const { targetDatabaseId } = options;
	const { sourceCache, targetCache, layer, targetName } = resolveCloneContext(options);

	// Pre-flight: check QP name before writing any dependencies
	const existingQp = await batchExistingNames(targetCache, 'quality_profiles', [targetName]);
	if (existingQp.has(targetName.toLowerCase())) {
		throw new ConflictError(
			`Quality profile "${targetName}" already exists in the target database. ` +
				'Choose a different name or use the same-database clone to auto-rename.'
		);
	}

	// Serialize QP and all its CFs from source (parallel)
	const portable = await serialize.serializeQualityProfile(sourceCache, options.sourceName);
	const cfNames = [...new Set(portable.customFormatScores.map((s) => s.customFormatName))];
	const cfPortableList = await Promise.all(
		cfNames.map((n) => serialize.serializeCustomFormat(sourceCache, n))
	);
	const cfPortables = new Map(cfNames.map((n, i) => [n, cfPortableList[i]]));

	// Phase 1: Clone regex deps — one recompile covers all regex writes
	const regexRenameMap = await cloneRegexDeps(targetDatabaseId, sourceCache, targetCache, layer, [
		...cfPortables.values()
	]);

	// Resolve CF target names, apply regex renames, and determine which CFs need writing
	let cache = freshTargetCache(targetDatabaseId);
	const existingCfNames = await batchExistingNames(cache, 'custom_formats', cfNames);
	const cfRenameMap = new Map<string, string>();
	const cfsToWrite: PortableCustomFormat[] = [];
	const reservedCfNames = new Set<string>();

	for (const cfName of cfNames) {
		const cfPortable = cfPortables.get(cfName)!;
		applyRegexRenames(cfPortable, regexRenameMap);

		const { targetName, skipWrite } = await resolveDep(
			cfName,
			cfPortable,
			cache,
			existingCfNames,
			'custom_formats',
			serialize.serializeCustomFormat,
			cfContentMatches,
			'custom format',
			reservedCfNames
		);
		cfPortable.name = targetName;
		reservedCfNames.add(targetName.toLowerCase());
		if (targetName !== cfName) cfRenameMap.set(cfName, targetName);
		if (!skipWrite) cfsToWrite.push(cfPortable);
	}

	// Phase 2A: Create new CF structures. With skipRecompile, cfQueries.create consolidates
	// all SQL (insert + tags) into a single writeOperation, so the FK passes in one savepoint
	// and no recompile fires per-CF. One recompile after the loop flushes everything.
	//
	// Note: each cfQueries.create commits its own operation independently. If a later CF fails,
	// earlier CFs are already committed to the ops table. This is a best-effort design — the
	// caller should verify the target state and retry if needed.
	if (cfsToWrite.length > 0) {
		const createdCfNames: string[] = [];
		try {
			for (const cfPortable of cfsToWrite) {
				const createResult = await cfQueries.create({
					databaseId: targetDatabaseId,
					cache,
					layer,
					input: {
						name: cfPortable.name,
						description: cfPortable.description,
						includeInRename: cfPortable.includeInRename,
						tags: cfPortable.tags
					},
					skipRecompile: true
				});
				if (!createResult.success) {
					throw new Error(
						createResult.error ?? `Failed to create custom format "${cfPortable.name}"`
					);
				}
				createdCfNames.push(cfPortable.name);
			}
		} catch (err) {
			// Best-effort cleanup: remove any CFs that were created before the failure.
			for (const name of createdCfNames) {
				try {
					const row = await cache.kb
						.selectFrom('custom_formats')
						.select('id')
						.where('name', '=', name)
						.executeTakeFirst();
					if (row) {
						await cfQueries.remove({
							databaseId: targetDatabaseId,
							cache,
							layer,
							formatId: row.id,
							formatName: name
						});
					}
				} catch {
					// Cleanup is best-effort; ignore individual failures
				}
			}
			throw err;
		}
		await recompileCache(targetDatabaseId);
		cache = freshTargetCache(targetDatabaseId);
	}

	// Phase 2B: Update conditions for new CFs only
	for (const cfPortable of cfsToWrite) {
		if (cfPortable.conditions.length === 0) continue;
		await cfQueries.updateConditions({
			databaseId: targetDatabaseId,
			cache,
			layer,
			formatName: cfPortable.name,
			originalConditions: [],
			conditions: cfPortable.conditions,
			skipRecompile: true
		});
	}

	if (cfsToWrite.some((cf) => cf.conditions.length > 0)) {
		await recompileCache(targetDatabaseId);
		cache = freshTargetCache(targetDatabaseId);
	}

	// Phase 2C: Create tests for new CFs only
	for (const cfPortable of cfsToWrite) {
		for (const test of cfPortable.tests) {
			await cfQueries.createTest({
				databaseId: targetDatabaseId,
				layer,
				formatName: cfPortable.name,
				skipRecompile: true,
				input: {
					title: test.title,
					type: test.type,
					should_match: test.shouldMatch,
					description: test.description
				}
			});
		}
	}

	if (cfsToWrite.some((cf) => cf.tests.length > 0)) {
		await recompileCache(targetDatabaseId);
		cache = freshTargetCache(targetDatabaseId);
	}

	// Phase 3: Clone quality profile (scoring FKs on CF names — all CFs now in KB)
	for (const score of portable.customFormatScores) {
		const renamed = cfRenameMap.get(score.customFormatName);
		if (renamed) score.customFormatName = renamed;
	}

	portable.name = targetName;

	// Filter orderedItems to only include qualities that exist in the target database.
	// Without this, a source quality name absent from the target's qualities table
	// would cause an FK violation when qpQueries.create INSERTs into quality_profile_qualities.
	const targetQualityRows = await cache.kb.selectFrom('qualities').select('name').execute();
	const targetQualityNames = new Set(targetQualityRows.map((r) => r.name.toLowerCase()));
	portable.orderedItems = filterQualityItemsForTarget(portable.orderedItems, targetQualityNames);

	const qpResult = await qpQueries.create({
		databaseId: targetDatabaseId,
		cache,
		layer,
		input: {
			name: portable.name,
			description: portable.description,
			tags: portable.tags,
			language: portable.language,
			orderedItems: portable.orderedItems
		}
	});

	if (!qpResult.success) {
		throw new Error(qpResult.error ?? 'Failed to create quality profile');
	}

	// Re-fetch after qpQueries.create recompiles
	const scoringResult = await qpQueries.updateScoring({
		databaseId: targetDatabaseId,
		cache: freshTargetCache(targetDatabaseId),
		layer,
		profileName: portable.name,
		input: {
			upgradesAllowed: portable.upgradesAllowed ?? true,
			minimumScore: portable.minimumScore,
			upgradeUntilScore: portable.upgradeUntilScore,
			upgradeScoreIncrement: portable.upgradeScoreIncrement,
			customFormatScores: portable.customFormatScores
		}
	});

	if (!scoringResult.success) {
		throw new Error(scoringResult.error ?? 'Failed to update quality profile scoring');
	}

	return qpResult;
}

/** Generic cross-database clone. Routes quality_profile and custom_format to their specialised functions; handles all other entity types directly. */
export async function cloneEntityAcross(options: CloneAcrossOptions) {
	const { entityType } = options;

	if (entityType === 'quality_profile') return cloneQualityProfileAcross(options);
	if (entityType === 'custom_format') return cloneCustomFormatAcross(options);

	const { sourceCache, targetCache, layer, targetName } = resolveCloneContext(options);
	const { serializeFn, deserializeFn } = ENTITY_FNS[entityType];

	// Pre-flight: reject with ConflictError if name already exists in target
	const table = ENTITY_TABLE[entityType];
	const existing = await targetCache.kb
		.selectFrom(table as never)
		.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', targetName.toLowerCase()))
		.select('name')
		.executeTakeFirst();
	if (existing) {
		throw new ConflictError(
			`${entityType.replace(/_/g, ' ')} "${targetName}" already exists in the target database.`
		);
	}

	const portable = await serializeFn(sourceCache, options.sourceName);
	portable.name = targetName;

	return deserializeFn({
		databaseId: options.targetDatabaseId,
		cache: targetCache,
		layer,
		portable: portable as never
	});
}
