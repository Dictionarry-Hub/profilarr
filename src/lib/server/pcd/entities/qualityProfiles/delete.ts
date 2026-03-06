/**
 * Delete a quality profile operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';

// ============================================================================
// Input types
// ============================================================================

interface RemoveQualityProfileOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	profileId: number;
	profileName: string;
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Delete a quality profile by writing an operation to the specified layer
 */
export async function remove(options: RemoveQualityProfileOptions) {
	const { databaseId, cache, layer, profileName } = options;
	const db = cache.kb;

	const queries = [];

	// Snapshot counts for metadata/diff
	const tagCountRow = await db
		.selectFrom('quality_profile_tags')
		.select(db.fn.count<number>('quality_profile_name').as('count'))
		.where('quality_profile_name', '=', profileName)
		.executeTakeFirst();
	const languageCountRow = await db
		.selectFrom('quality_profile_languages')
		.select(db.fn.count<number>('quality_profile_name').as('count'))
		.where('quality_profile_name', '=', profileName)
		.executeTakeFirst();
	const qualitiesCountRow = await db
		.selectFrom('quality_profile_qualities')
		.select(db.fn.count<number>('quality_profile_name').as('count'))
		.where('quality_profile_name', '=', profileName)
		.executeTakeFirst();
	const cfCountRow = await db
		.selectFrom('quality_profile_custom_formats')
		.select(db.fn.count<number>('quality_profile_name').as('count'))
		.where('quality_profile_name', '=', profileName)
		.executeTakeFirst();
	const groupCountRow = await db
		.selectFrom('quality_groups')
		.select(db.fn.count<number>('quality_profile_name').as('count'))
		.where('quality_profile_name', '=', profileName)
		.executeTakeFirst();

	// Delete associated tags
	const deleteProfileTags = db
		.deleteFrom('quality_profile_tags')
		.where('quality_profile_name', '=', profileName)
		.compile();

	queries.push(deleteProfileTags);

	// Delete associated languages
	const deleteProfileLanguages = db
		.deleteFrom('quality_profile_languages')
		.where('quality_profile_name', '=', profileName)
		.compile();

	queries.push(deleteProfileLanguages);

	// Delete associated qualities
	const deleteProfileQualities = db
		.deleteFrom('quality_profile_qualities')
		.where('quality_profile_name', '=', profileName)
		.compile();

	queries.push(deleteProfileQualities);

	// Delete associated custom formats
	const deleteProfileCustomFormats = db
		.deleteFrom('quality_profile_custom_formats')
		.where('quality_profile_name', '=', profileName)
		.compile();

	queries.push(deleteProfileCustomFormats);

	// Delete quality groups for this profile
	const deleteQualityGroups = db
		.deleteFrom('quality_groups')
		.where('quality_profile_name', '=', profileName)
		.compile();

	queries.push(deleteQualityGroups);

	// Delete the quality profile itself
	const deleteProfile = db.deleteFrom('quality_profiles').where('name', '=', profileName).compile();

	queries.push(deleteProfile);

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-quality-profile-${profileName}`,
		queries,
		desiredState: {
			deleted: true,
			name: profileName,
			counts: {
				tags: tagCountRow?.count ?? 0,
				languages: languageCountRow?.count ?? 0,
				qualities: qualitiesCountRow?.count ?? 0,
				custom_format_scores: cfCountRow?.count ?? 0,
				groups: groupCountRow?.count ?? 0
			}
		},
		metadata: {
			operation: 'delete',
			entity: 'quality_profile',
			name: profileName,
			stableKey: { key: 'quality_profile_name', value: profileName },
			changedFields: ['deleted'],
			summary: 'Delete quality profile',
			title: `Delete quality profile "${profileName}"`
		}
	});

	return result;
}
