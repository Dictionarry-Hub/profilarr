/**
 * Update quality profile general information and languages
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { QualityProfileGeneral } from '$shared/pcd/display.ts';
import { logger } from '$logger/logger.ts';

// ============================================================================
// Input types
// ============================================================================

interface UpdateGeneralInput {
	name: string;
	description: string;
	tags: string[];
	language: string | null;
}

interface UpdateGeneralOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	current: QualityProfileGeneral;
	input: UpdateGeneralInput;
}

interface UpdateLanguagesInput {
	languageName: string | null;
	type: 'must' | 'only' | 'not' | 'simple';
}

interface UpdateLanguagesOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	profileName: string;
	input: UpdateLanguagesInput;
}

// ============================================================================
// Mutations
// ============================================================================

/**
 * Escape a string for SQL
 */
function esc(value: string): string {
	return value.replace(/'/g, "''");
}

/**
 * Update quality profile general information
 */
export async function updateGeneral(options: UpdateGeneralOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('quality_profiles')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			await logger.warn(`Duplicate quality profile name "${input.name}"`, {
				source: 'QualityProfile',
				meta: { databaseId, name: input.name }
			});
			throw new Error(`A quality profile with name "${input.name}" already exists`);
		}
	}

	const rawProfile = await db
		.selectFrom('quality_profiles')
		.select('description')
		.where('name', '=', current.name)
		.executeTakeFirst();
	const rawCurrentDescription = rawProfile?.description ?? null;
	const normalizedCurrentDescription = rawCurrentDescription ?? '';
	const normalizedNextDescription = input.description?.trim() ?? '';
	const descriptionChanged = normalizedCurrentDescription !== normalizedNextDescription;
	const renameChanged = current.name !== input.name;
	const languageChanged = current.language !== input.language;

	// Tags are tracked independently from guarded fields.
	const currentTagNames = current.tags.map((t) => t.name);
	const newTagNames = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));
	const tagsToRemove = currentTagNames.filter((t) => !newTagNames.includes(t));
	const tagsToAdd = newTagNames.filter((t) => !currentTagNames.includes(t));
	const hasTagChanges = tagsToAdd.length > 0 || tagsToRemove.length > 0;

	const changes: Record<string, { from: unknown; to: unknown }> = {};
	if (renameChanged) {
		changes.name = { from: current.name, to: input.name };
	}
	if (descriptionChanged) {
		changes.description = {
			from: rawCurrentDescription ?? null,
			to: normalizedNextDescription === '' ? null : normalizedNextDescription
		};
	}
	if (tagsToAdd.length > 0 || tagsToRemove.length > 0) {
		changes.tags = { from: currentTagNames, to: newTagNames };
	}
	if (languageChanged) {
		changes.language = { from: current.language, to: input.language };
	}

	// 1. Build description query
	const descriptionQueries = [];
	if (descriptionChanged) {
		let updateDescription = db
			.updateTable('quality_profiles')
			.set({ description: normalizedNextDescription === '' ? null : normalizedNextDescription })
			.where('name', '=', current.name);
		if (rawCurrentDescription === null) {
			updateDescription = updateDescription.where('description', 'is', null);
		} else {
			updateDescription = updateDescription.where('description', '=', rawCurrentDescription);
		}
		descriptionQueries.push(updateDescription.compile());
	}

	// 2. Build language queries
	const languageQueries = [];
	if (languageChanged) {
		if (current.language !== null) {
			const deleteLanguage = {
				sql: `DELETE FROM quality_profile_languages WHERE quality_profile_name = '${esc(current.name)}' AND language_name = '${esc(current.language)}'`,
				parameters: [],
				query: {} as never
			};
			languageQueries.push(deleteLanguage);
		}

		if (input.language !== null) {
			const insertLanguage = {
				sql: `INSERT INTO quality_profile_languages (quality_profile_name, language_name, type)
SELECT '${esc(current.name)}', '${esc(input.language)}', 'simple'
WHERE NOT EXISTS (
  SELECT 1 FROM quality_profile_languages
  WHERE quality_profile_name = '${esc(current.name)}'
)`,
				parameters: [],
				query: {} as never
			};
			languageQueries.push(insertLanguage);
		}
	}

	// 3. Build tag queries against current name. Rename (if any) is emitted
	// in a separate op after tags, so these queries stay valid.
	const tagQueries = [];
	for (const tagName of tagsToRemove) {
		const removeTag = {
			sql: `DELETE FROM quality_profile_tags WHERE quality_profile_name = '${esc(current.name)}' AND tag_name = '${esc(tagName)}'`,
			parameters: [],
			query: {} as never
		};
		tagQueries.push(removeTag);
	}

	for (const tagName of tagsToAdd) {
		const insertTag = db
			.insertInto('tags')
			.values({ name: tagName })
			.onConflict((oc) => oc.column('name').doNothing())
			.compile();
		tagQueries.push(insertTag);

		const linkTag = {
			sql: `INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES ('${esc(current.name)}', '${esc(tagName)}')`,
			parameters: [],
			query: {} as never
		};
		tagQueries.push(linkTag);
	}

	// 4. Build rename query (run last)
	const renameQueries = [];
	if (renameChanged) {
		const updateName = db
			.updateTable('quality_profiles')
			.set({ name: input.name })
			.where('name', '=', current.name)
			.compile();
		renameQueries.push(updateName);
	}

	if (!descriptionChanged && !languageChanged && !hasTagChanges && !renameChanged) {
		return { success: true };
	}

	await logger.info(`Save quality profile "${input.name}"`, {
		source: 'QualityProfile',
		meta: {
			id: current.id,
			changes
		}
	});

	let lastResult: Awaited<ReturnType<typeof writeOperation>> | null = null;

	if (descriptionChanged) {
		const descriptionResult = await writeOperation({
			databaseId,
			layer,
			description: `update-quality-profile-description-${input.name}`,
			queries: descriptionQueries,
			desiredState: {
				description: {
					from: rawCurrentDescription ?? null,
					to: normalizedNextDescription === '' ? null : normalizedNextDescription
				}
			},
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: input.name,
				stableKey: { key: 'quality_profile_name', value: current.name },
				changedFields: ['description'],
				summary: 'Update quality profile description',
				title: `Update description for quality profile "${input.name}"`
			}
		});

		if (!descriptionResult.success) {
			return descriptionResult;
		}
		lastResult = descriptionResult;
	}

	if (languageChanged) {
		const languageResult = await writeOperation({
			databaseId,
			layer,
			description: `update-quality-profile-language-${input.name}`,
			queries: languageQueries,
			desiredState: {
				language: {
					from: current.language ?? null,
					to: input.language ?? null,
					type: 'simple'
				}
			},
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: input.name,
				stableKey: { key: 'quality_profile_name', value: current.name },
				changedFields: ['language'],
				summary: 'Update quality profile language',
				title: `Update language for quality profile "${input.name}"`
			}
		});

		if (!languageResult.success) {
			return languageResult;
		}
		lastResult = languageResult;
	}

	if (hasTagChanges) {
		const tagsResult = await writeOperation({
			databaseId,
			layer,
			description: `update-quality-profile-tags-${input.name}`,
			queries: tagQueries,
			desiredState: { tags: { add: tagsToAdd, remove: tagsToRemove } },
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: input.name,
				stableKey: { key: 'quality_profile_name', value: current.name },
				changedFields: ['tags'],
				summary: 'Update quality profile tags',
				title: `Update tags for quality profile "${input.name}"`
			}
		});

		if (!tagsResult.success) {
			return tagsResult;
		}
		lastResult = tagsResult;
	}

	if (renameChanged) {
		const renameResult = await writeOperation({
			databaseId,
			layer,
			description: `update-quality-profile-name-${input.name}`,
			queries: renameQueries,
			desiredState: {
				name: { from: current.name, to: input.name }
			},
			metadata: {
				operation: 'update',
				entity: 'quality_profile',
				name: input.name,
				previousName: current.name,
				stableKey: { key: 'quality_profile_name', value: current.name },
				changedFields: ['name'],
				summary: 'Rename quality profile',
				title: `Rename quality profile "${current.name}"`
			}
		});

		if (!renameResult.success) {
			return renameResult;
		}
		lastResult = renameResult;
	}

	return lastResult ?? { success: true };
}

/**
 * Update quality profile language configuration
 */
export async function updateLanguages(options: UpdateLanguagesOptions) {
	const { databaseId, cache, layer, profileName, input } = options;
	const db = cache.kb;

	const queries = [];

	// 1. Delete existing languages for this profile
	const deleteLanguages = db
		.deleteFrom('quality_profile_languages')
		.where('quality_profile_name', '=', profileName)
		.compile();
	queries.push(deleteLanguages);

	// 2. Insert new language if one is selected
	if (input.languageName !== null) {
		const insertLanguage = {
			sql: `INSERT INTO quality_profile_languages (quality_profile_name, language_name, type) VALUES ('${profileName.replace(/'/g, "''")}', '${input.languageName.replace(/'/g, "''")}', '${input.type}')`,
			parameters: [],
			query: {} as never
		};
		queries.push(insertLanguage);
	}

	await logger.info(`Save quality profile languages "${profileName}"`, {
		source: 'QualityProfile',
		meta: {
			profileName,
			languageName: input.languageName,
			type: input.type
		}
	});

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `update-quality-profile-languages-${profileName}`,
		queries,
		metadata: {
			operation: 'update',
			entity: 'quality_profile',
			name: profileName
		}
	});

	return result;
}
