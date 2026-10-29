/**
 * Quality profile general queries
 */

import type { PCDCache } from '#pcd/index.ts';
import type { QualityProfileGeneral, QualityProfileLanguages } from '#shared/pcd/display.ts';

/**
 * Get general information for a single quality profile
 */
export async function general(
	cache: PCDCache,
	profileId: number
): Promise<QualityProfileGeneral | null> {
	const db = cache.kb;

	// Get the quality profile
	const profile = await db
		.selectFrom('quality_profiles')
		.select(['id', 'name', 'description'])
		.where('id', '=', profileId)
		.executeTakeFirst();

	if (!profile) return null;

	// Get tags for this profile
	const tags = await db
		.selectFrom('quality_profile_tags as qpt')
		.innerJoin('tags as t', 't.name', 'qpt.tag_name')
		.select(['t.name as tag_name', 't.created_at as tag_created_at'])
		.where('qpt.quality_profile_name', '=', profile.name)
		.orderBy('t.name')
		.execute();

	// Get language for this profile (first one if exists)
	const languageRow = await db
		.selectFrom('quality_profile_languages as qpl')
		.select(['qpl.language_name'])
		.where('qpl.quality_profile_name', '=', profile.name)
		.executeTakeFirst();

	return {
		id: profile.id,
		name: profile.name,
		description: profile.description || '',
		tags: tags.map((tag) => ({
			name: tag.tag_name,
			created_at: tag.tag_created_at
		})),
		language: languageRow?.language_name ?? null
	};
}

/**
 * Get languages for a quality profile
 */
export async function languages(
	cache: PCDCache,
	profileName: string
): Promise<QualityProfileLanguages> {
	const db = cache.kb;

	const profileLanguages = await db
		.selectFrom('quality_profile_languages as qpl')
		.innerJoin('languages as l', 'qpl.language_name', 'l.name')
		.select(['l.name as language_name', 'qpl.type'])
		.where('qpl.quality_profile_name', '=', profileName)
		.orderBy('l.name')
		.execute();

	return {
		languages: profileLanguages.map((lang) => ({
			name: lang.language_name,
			type: lang.type as 'must' | 'only' | 'not' | 'simple'
		}))
	};
}
