/**
 * Quality profile list queries
 */

import { sql } from 'kysely';
import type { PCDCache } from '#pcd/index.ts';
import type {
	Tag,
	QualityProfileTableRow,
	QualityItem,
	ProfileLanguage,
	CustomFormatCounts,
	QualityProfileOption
} from '#shared/pcd/display.ts';

/**
 * Get quality profiles with full data for table/card views
 * Optimized to minimize database queries
 */
export async function list(cache: PCDCache): Promise<QualityProfileTableRow[]> {
	const db = cache.kb;

	// 1. Get all quality profiles
	const profiles = await db
		.selectFrom('quality_profiles')
		.select([
			'id',
			'name',
			'description',
			'upgrades_allowed',
			'minimum_custom_format_score',
			'upgrade_until_score',
			'upgrade_score_increment'
		])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	if (profiles.length === 0) return [];

	const profileNames = profiles.map((p) => p.name);

	// 2. Get all tags for all profiles
	const allTags = await db
		.selectFrom('quality_profile_tags as qpt')
		.innerJoin('tags as t', 't.name', 'qpt.tag_name')
		.select(['qpt.quality_profile_name', 't.name as tag_name', 't.created_at as tag_created_at'])
		.where('qpt.quality_profile_name', 'in', profileNames)
		.orderBy('qpt.quality_profile_name')
		.orderBy('t.name')
		.execute();

	// 3. Get custom format counts grouped by arr_type
	const formatCounts = await db
		.selectFrom('quality_profile_custom_formats')
		.select(['quality_profile_name', 'arr_type'])
		.select((eb) => eb.fn.count('quality_profile_name').as('count'))
		.where('quality_profile_name', 'in', profileNames)
		.groupBy(['quality_profile_name', 'arr_type'])
		.execute();

	// 4. Get all qualities for all profiles with names
	const allQualities = await db
		.selectFrom('quality_profile_qualities as qpq')
		.leftJoin('qualities as q', 'qpq.quality_name', 'q.name')
		.leftJoin('quality_groups as qg', (join) =>
			join
				.onRef('qpq.quality_group_name', '=', 'qg.name')
				.onRef('qpq.quality_profile_name', '=', 'qg.quality_profile_name')
		)
		.select([
			'qpq.quality_profile_name',
			'qpq.position',
			'qpq.upgrade_until',
			'qpq.quality_name',
			'qpq.quality_group_name',
			'q.name as resolved_quality_name',
			'qg.name as group_name'
		])
		.where('qpq.quality_profile_name', 'in', profileNames)
		.where('qpq.enabled', '=', 1)
		.orderBy('qpq.quality_profile_name')
		.orderBy('qpq.position')
		.execute();

	// 5. Get languages for all profiles
	const allLanguages = await db
		.selectFrom('quality_profile_languages as qpl')
		.innerJoin('languages as l', 'qpl.language_name', 'l.name')
		.select(['qpl.quality_profile_name', 'l.name as language_name', 'qpl.type'])
		.where('qpl.quality_profile_name', 'in', profileNames)
		.execute();

	// Build maps for efficient lookup
	const tagsMap = new Map<string, Tag[]>();
	for (const tag of allTags) {
		if (!tagsMap.has(tag.quality_profile_name)) {
			tagsMap.set(tag.quality_profile_name, []);
		}
		tagsMap.get(tag.quality_profile_name)!.push({
			name: tag.tag_name,
			created_at: tag.tag_created_at
		});
	}

	const formatCountsMap = new Map<string, Omit<CustomFormatCounts, 'total'>>();
	for (const fc of formatCounts) {
		if (!formatCountsMap.has(fc.quality_profile_name)) {
			formatCountsMap.set(fc.quality_profile_name, { all: 0, radarr: 0, sonarr: 0 });
		}
		const counts = formatCountsMap.get(fc.quality_profile_name)!;
		const count = Number(fc.count);
		if (fc.arr_type === 'all') counts.all = count;
		else if (fc.arr_type === 'radarr') counts.radarr = count;
		else if (fc.arr_type === 'sonarr') counts.sonarr = count;
	}

	const qualitiesMap = new Map<string, QualityItem[]>();
	for (const qual of allQualities) {
		if (!qualitiesMap.has(qual.quality_profile_name)) {
			qualitiesMap.set(qual.quality_profile_name, []);
		}

		qualitiesMap.get(qual.quality_profile_name)!.push({
			position: qual.position,
			type: qual.quality_name ? 'quality' : 'group',
			name: qual.quality_name || qual.group_name!,
			is_upgrade_until: qual.upgrade_until === 1
		});
	}

	const languagesMap = new Map<string, ProfileLanguage>();
	for (const lang of allLanguages) {
		languagesMap.set(lang.quality_profile_name, {
			name: lang.language_name,
			type: lang.type as 'must' | 'only' | 'not' | 'simple'
		});
	}

	// Build the final result
	const results = profiles.map((profile) => {
		const counts = formatCountsMap.get(profile.name) || { all: 0, radarr: 0, sonarr: 0 };

		const result: QualityProfileTableRow = {
			id: profile.id,
			name: profile.name,
			description: profile.description ?? '',
			tags: tagsMap.get(profile.name) || [],
			upgrades_allowed: profile.upgrades_allowed === 1,
			minimum_custom_format_score: profile.minimum_custom_format_score,
			custom_formats: {
				all: counts.all,
				radarr: counts.radarr,
				sonarr: counts.sonarr,
				total: counts.all + counts.radarr + counts.sonarr
			},
			qualities: qualitiesMap.get(profile.name) || [],
			language: languagesMap.get(profile.name)
		};

		// Only include upgrade settings if upgrades are allowed
		if (profile.upgrades_allowed === 1) {
			result.upgrade_until_score = profile.upgrade_until_score;
			result.upgrade_score_increment = profile.upgrade_score_increment;
		}

		return result;
	});

	return results;
}

/**
 * Get all quality profile names from a cache
 */
export async function names(cache: PCDCache): Promise<string[]> {
	const db = cache.kb;

	const profiles = await db
		.selectFrom('quality_profiles')
		.select(['name'])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	return profiles.map((p) => p.name);
}

/**
 * Get quality profile options for select/dropdown components
 */
export async function select(cache: PCDCache): Promise<QualityProfileOption[]> {
	const db = cache.kb;

	const profiles = await db
		.selectFrom('quality_profiles')
		.select(['id', 'name'])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	return profiles;
}
