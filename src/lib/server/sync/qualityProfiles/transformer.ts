/**
 * Quality Profile Transformer
 * Transforms PCD quality profile data to arr API format
 */

import type { PCDCache } from '$pcd/index.ts';
import type {
	ArrQualityProfileItem,
	ArrQualityProfilePayload,
	QualityProfileFormatItem
} from '$arr/types.ts';
import {
	type SyncArrType,
	getAllQualities,
	getLanguageForProfile,
	mapQualityName
} from '../mappings.ts';

// =============================================================================
// PCD Data Types
// =============================================================================

export interface PcdQualityProfile {
	id: number;
	name: string;
	upgradesAllowed: boolean;
	minimumCustomFormatScore: number;
	upgradeUntilScore: number;
	upgradeScoreIncrement: number;
	qualities: PcdQualityItem[];
	language: PcdLanguageConfig | null;
	customFormats: PcdCustomFormatScore[];
}

export interface PcdQualityItem {
	type: 'quality' | 'group';
	referenceId: number;
	name: string;
	position: number;
	enabled: boolean;
	upgradeUntil: boolean;
	members?: { id: number; name: string }[];
}

export interface PcdLanguageConfig {
	id: number;
	name: string;
	type: 'must' | 'only' | 'not' | 'simple';
}

export interface PcdCustomFormatScore {
	formatId: number;
	formatName: string;
	score: number;
}

// =============================================================================
// Transformer Functions
// =============================================================================

/**
 * Convert PCD group ID to arr group ID
 * PCD uses sequential IDs, arr expects 1000+offset for groups
 */
function convertGroupId(_groupId: number, index: number): number {
	return 1000 + index + 1;
}

/**
 * Transform a PCD quality profile to arr API format
 *
 * @param formatIdMap - Maps PCD CF names → arr IDs.
 *                      Used to resolve explicit CF scores and to include every CF with score 0
 *                      (arr validation requirement).
 */
export function transformQualityProfile(
	profile: PcdQualityProfile,
	arrType: SyncArrType,
	qualityApiMappings: Map<string, string>,
	formatIdMap: Map<string, number>
): ArrQualityProfilePayload {
	const allQualities = getAllQualities(arrType);

	// Build quality items
	const items: ArrQualityProfileItem[] = [];
	const usedQualityNames = new Set<string>();
	const qualityIdsInGroups = new Set<number>();
	let cutoffId: number | undefined;
	let groupIndex = 0;

	// First pass: identify qualities in groups
	for (const item of profile.qualities) {
		if (item.type === 'group' && item.members) {
			for (const member of item.members) {
				const apiName =
					qualityApiMappings.get(member.name.toLowerCase()) ?? mapQualityName(member.name, arrType);
				const quality = allQualities[apiName];
				if (quality) {
					qualityIdsInGroups.add(quality.id);
				}
			}
		}
	}

	// Second pass: build items
	for (const item of profile.qualities) {
		if (item.type === 'group') {
			// Group item
			const groupId = convertGroupId(item.referenceId, groupIndex++);

			const groupItem: ArrQualityProfileItem = {
				id: groupId,
				name: item.name,
				items: [],
				allowed: item.enabled
			};

			// Add members
			if (item.members) {
				for (const member of item.members) {
					const apiName =
						qualityApiMappings.get(member.name.toLowerCase()) ??
						mapQualityName(member.name, arrType);
					const quality = allQualities[apiName];

					if (quality) {
						groupItem.items.push({
							quality: { ...quality },
							items: [],
							allowed: true
						});
						usedQualityNames.add(apiName.toUpperCase());
					}
				}
			}

			if (groupItem.items.length > 0) {
				items.push(groupItem);
			}

			// Check if this is the cutoff
			if (item.upgradeUntil) {
				cutoffId = groupId;
			}
		} else {
			// Single quality
			const apiName =
				qualityApiMappings.get(item.name.toLowerCase()) ?? mapQualityName(item.name, arrType);
			const quality = allQualities[apiName];

			if (quality) {
				items.push({
					quality: { ...quality },
					items: [],
					allowed: item.enabled
				});
				usedQualityNames.add(apiName.toUpperCase());

				// Check if this is the cutoff
				if (item.upgradeUntil) {
					cutoffId = quality.id;
				}
			}
		}
	}

	// Add unused qualities as disabled
	for (const [qualityName, quality] of Object.entries(allQualities)) {
		if (!usedQualityNames.has(qualityName.toUpperCase()) && !qualityIdsInGroups.has(quality.id)) {
			items.push({
				quality: { ...quality },
				items: [],
				allowed: false
			});
		}
	}

	// Reverse items to match arr expected order
	items.reverse();

	// Build language config (Radarr only - Sonarr uses custom formats for language filtering)
	const language =
		arrType === 'radarr'
			? getLanguageForProfile(profile.language?.name ?? 'any', arrType)
			: undefined;

	// Build format items
	const formatItems: QualityProfileFormatItem[] = [];
	const processedFormatIds = new Set<number>();

	// Add explicit scores from profile (resolve via PCD names → arr IDs)
	for (const cf of profile.customFormats) {
		const formatId = formatIdMap.get(cf.formatName);
		if (formatId !== undefined) {
			formatItems.push({
				format: formatId,
				name: cf.formatName,
				score: cf.score
			});
			processedFormatIds.add(formatId);
		}
	}

	// Add all other formats with score 0 (arr validation requirement — every CF must be listed)
	for (const [formatName, formatId] of formatIdMap) {
		if (!processedFormatIds.has(formatId)) {
			formatItems.push({
				format: formatId,
				name: formatName,
				score: 0
			});
			processedFormatIds.add(formatId);
		}
	}

	return {
		name: profile.name,
		items,
		...(language && { language }), // Only include for Radarr
		upgradeAllowed: profile.upgradesAllowed,
		cutoff: cutoffId ?? items[items.length - 1]?.quality?.id ?? 0,
		minFormatScore: profile.minimumCustomFormatScore,
		cutoffFormatScore: profile.upgradeUntilScore,
		minUpgradeFormatScore: Math.max(1, profile.upgradeScoreIncrement),
		formatItems
	};
}

// =============================================================================
// PCD Query Functions
// =============================================================================

/**
 * Fetch a quality profile from PCD cache with all related data
 */
export async function fetchQualityProfileFromPcd(
	cache: PCDCache,
	profileName: string,
	arrType: SyncArrType
): Promise<PcdQualityProfile | null> {
	const db = cache.kb;

	// Get profile base info
	const profile = await db
		.selectFrom('quality_profiles')
		.select([
			'id',
			'name',
			'upgrades_allowed',
			'minimum_custom_format_score',
			'upgrade_until_score',
			'upgrade_score_increment'
		])
		.where('name', '=', profileName)
		.executeTakeFirst();

	if (!profile) return null;

	const allQualities = await db.selectFrom('qualities').select(['id', 'name']).execute();

	// Get quality groups for this profile
	const groups = await db
		.selectFrom('quality_groups')
		.select(['name'])
		.where('quality_profile_name', '=', profile.name)
		.execute();

	// Get group members
	const groupMembers =
		groups.length > 0
			? await db
					.selectFrom('quality_group_members')
					.innerJoin('qualities', 'qualities.name', 'quality_group_members.quality_name')
					.select([
						'quality_group_members.quality_group_name',
						'qualities.id as quality_id',
						'qualities.name as quality_name'
					])
					.where('quality_group_members.quality_profile_name', '=', profile.name)
					.execute()
			: [];

	// Build groups map
	const groupsMap = new Map<string, { name: string; members: { id: number; name: string }[] }>();
	for (const group of groups) {
		groupsMap.set(group.name, { name: group.name, members: [] });
	}
	for (const member of groupMembers) {
		const group = groupsMap.get(member.quality_group_name);
		if (group) {
			group.members.push({ id: member.quality_id, name: member.quality_name });
		}
	}

	// Get ordered quality items
	const orderedItems = await db
		.selectFrom('quality_profile_qualities')
		.select(['quality_name', 'quality_group_name', 'position', 'enabled', 'upgrade_until'])
		.where('quality_profile_name', '=', profile.name)
		.orderBy('position')
		.execute();

	// Build quality items
	const qualities: PcdQualityItem[] = orderedItems.map((item) => {
		const isGroup = item.quality_group_name !== null;
		const name = isGroup ? item.quality_group_name! : item.quality_name!;
		// Get ID from name for referenceId (used for cutoff)
		const referenceId = isGroup
			? groups.findIndex((g) => g.name === name) + 1
			: (allQualities.find((q) => q.name === name)?.id ?? 0);

		const result: PcdQualityItem = {
			type: isGroup ? 'group' : 'quality',
			referenceId,
			name,
			position: item.position,
			enabled: item.enabled === 1,
			upgradeUntil: item.upgrade_until === 1
		};

		if (isGroup) {
			result.members = groupsMap.get(name)?.members || [];
		}

		return result;
	});

	// Get language config (first one if exists)
	const languageRow = await db
		.selectFrom('quality_profile_languages as qpl')
		.innerJoin('languages as l', 'l.name', 'qpl.language_name')
		.select(['l.id as language_id', 'l.name as language_name', 'qpl.type'])
		.where('qpl.quality_profile_name', '=', profile.name)
		.executeTakeFirst();

	const language: PcdLanguageConfig | null = languageRow
		? {
				id: languageRow.language_id,
				name: languageRow.language_name,
				type: languageRow.type as 'must' | 'only' | 'not' | 'simple'
			}
		: null;

	// Get custom format scores for this arr type
	const cfScores = await db
		.selectFrom('quality_profile_custom_formats as qpcf')
		.innerJoin('custom_formats as cf', 'cf.name', 'qpcf.custom_format_name')
		.select(['cf.id as format_id', 'cf.name as format_name', 'qpcf.score'])
		.where('qpcf.quality_profile_name', '=', profile.name)
		.where((eb) => eb.or([eb('qpcf.arr_type', '=', arrType), eb('qpcf.arr_type', '=', 'all')]))
		.execute();

	// For "all" type entries, if there's also a specific arr_type entry, prefer the specific one
	const cfScoresMap = new Map<string, PcdCustomFormatScore>();
	for (const row of cfScores) {
		// Later entries (specific arr_type) will override earlier ones (all)
		cfScoresMap.set(row.format_name, {
			formatId: row.format_id,
			formatName: row.format_name,
			score: row.score
		});
	}

	return {
		id: profile.id,
		name: profile.name,
		upgradesAllowed: profile.upgrades_allowed === 1,
		minimumCustomFormatScore: profile.minimum_custom_format_score,
		upgradeUntilScore: profile.upgrade_until_score,
		upgradeScoreIncrement: profile.upgrade_score_increment,
		qualities,
		language,
		customFormats: Array.from(cfScoresMap.values())
	};
}

/**
 * Get quality API mappings from PCD cache
 * Returns a map of PCD quality name (lowercase) -> arr API name
 */
export async function getQualityApiMappings(
	cache: PCDCache,
	arrType: SyncArrType
): Promise<Map<string, string>> {
	const rows = await cache.kb
		.selectFrom('quality_api_mappings as qam')
		.where('qam.arr_type', '=', arrType)
		.select(['qam.quality_name', 'qam.api_name'])
		.execute();

	const map = new Map<string, string>();
	for (const row of rows) {
		map.set(row.quality_name.toLowerCase(), row.api_name);
	}
	return map;
}

// getReferencedCustomFormatNames moved to $pcd/references.ts as getCustomFormatsForProfile
