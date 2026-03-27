/**
 * Entity Deserialization
 *
 * Creates entities from portable format by calling existing PCD create functions.
 * Used by clone (serialize → rename → deserialize) and future import.
 */

import type { PCDCache } from '$pcd/index.ts';
import { getCache, type OperationLayer } from '$pcd/index.ts';
import { recompileCache } from '$pcd/index.ts';
import type {
	PortableDelayProfile,
	PortableRegularExpression,
	PortableCustomFormat,
	PortableQualityProfile,
	PortableRadarrNaming,
	PortableSonarrNaming,
	PortableMediaSettings,
	PortableQualityDefinitions
} from '$shared/pcd/portable.ts';
import * as delayProfileQueries from './delayProfiles/index.ts';
import * as regexQueries from './regularExpressions/index.ts';
import * as cfQueries from './customFormats/index.ts';
import * as qpQueries from './qualityProfiles/index.ts';
import * as namingQueries from './mediaManagement/naming/index.ts';
import * as mediaSettingsQueries from './mediaManagement/media-settings/index.ts';
import * as qualityDefsQueries from './mediaManagement/quality-definitions/index.ts';

// ============================================================================
// COMMON OPTIONS
// ============================================================================

interface DeserializeOptions<T> {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	portable: T;
}

// ============================================================================
// DELAY PROFILES
// ============================================================================

export async function deserializeDelayProfile(options: DeserializeOptions<PortableDelayProfile>) {
	const { databaseId, cache, layer, portable } = options;

	return delayProfileQueries.create({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

// ============================================================================
// REGULAR EXPRESSIONS
// ============================================================================

export async function deserializeRegularExpression(
	options: DeserializeOptions<PortableRegularExpression>
) {
	const { databaseId, cache, layer, portable } = options;

	return regexQueries.create({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

// ============================================================================
// CUSTOM FORMATS
// ============================================================================

export async function deserializeCustomFormat(options: DeserializeOptions<PortableCustomFormat>) {
	const { databaseId, cache, layer, portable } = options;

	// 1. Create the format
	const createResult = await cfQueries.create({
		databaseId,
		cache,
		layer,
		input: {
			name: portable.name,
			description: portable.description,
			includeInRename: portable.includeInRename,
			tags: portable.tags
		}
	});

	// 2. Add conditions (empty originalConditions = all new)
	if (portable.conditions.length > 0) {
		const freshCache = getCache(databaseId);
		if (!freshCache) throw new Error('Database cache not available');

		await cfQueries.updateConditions({
			databaseId,
			cache: freshCache,
			layer,
			formatName: portable.name,
			originalConditions: [],
			conditions: portable.conditions
		});
	}

	// 3. Add tests (skip recompile per-test, recompile once at end)
	for (const test of portable.tests) {
		await cfQueries.createTest({
			databaseId,
			layer,
			formatName: portable.name,
			skipRecompile: true,
			input: {
				title: test.title,
				type: test.type,
				should_match: test.shouldMatch,
				description: test.description
			}
		});
	}

	if (portable.tests.length > 0) {
		await recompileCache(databaseId);
	}

	return createResult;
}

// ============================================================================
// QUALITY PROFILES
// ============================================================================

export async function deserializeQualityProfile(
	options: DeserializeOptions<PortableQualityProfile>
) {
	const { databaseId, cache, layer, portable } = options;

	// 1. Create the profile with the source qualities directly
	const createResult = await qpQueries.create({
		databaseId,
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

	if (!createResult.success) {
		throw new Error(createResult.error ?? 'Failed to create quality profile');
	}

	// 2. Update scoring
	const freshCache = getCache(databaseId);
	if (!freshCache) throw new Error('Database cache not available');

	await qpQueries.updateScoring({
		databaseId,
		cache: freshCache,
		layer,
		profileName: portable.name,
		input: {
			minimumScore: portable.minimumScore,
			upgradeUntilScore: portable.upgradeUntilScore,
			upgradeScoreIncrement: portable.upgradeScoreIncrement,
			customFormatScores: portable.customFormatScores
		}
	});

	return createResult;
}

// ============================================================================
// NAMING
// ============================================================================

export async function deserializeRadarrNaming(options: DeserializeOptions<PortableRadarrNaming>) {
	const { databaseId, cache, layer, portable } = options;

	return namingQueries.createRadarrNaming({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

export async function deserializeSonarrNaming(options: DeserializeOptions<PortableSonarrNaming>) {
	const { databaseId, cache, layer, portable } = options;

	return namingQueries.createSonarrNaming({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

// ============================================================================
// MEDIA SETTINGS
// ============================================================================

export async function deserializeRadarrMediaSettings(
	options: DeserializeOptions<PortableMediaSettings>
) {
	const { databaseId, cache, layer, portable } = options;

	return mediaSettingsQueries.createRadarrMediaSettings({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

export async function deserializeSonarrMediaSettings(
	options: DeserializeOptions<PortableMediaSettings>
) {
	const { databaseId, cache, layer, portable } = options;

	return mediaSettingsQueries.createSonarrMediaSettings({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

// ============================================================================
// QUALITY DEFINITIONS
// ============================================================================

export async function deserializeRadarrQualityDefinitions(
	options: DeserializeOptions<PortableQualityDefinitions>
) {
	const { databaseId, cache, layer, portable } = options;

	return qualityDefsQueries.createRadarrQualityDefinitions({
		databaseId,
		cache,
		layer,
		input: portable
	});
}

export async function deserializeSonarrQualityDefinitions(
	options: DeserializeOptions<PortableQualityDefinitions>
) {
	const { databaseId, cache, layer, portable } = options;

	return qualityDefsQueries.createSonarrQualityDefinitions({
		databaseId,
		cache,
		layer,
		input: portable
	});
}
