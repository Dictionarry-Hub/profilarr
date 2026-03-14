/**
 * Create a quality profile operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import { logger } from '$logger/logger.ts';
import type { OrderedItem } from '$shared/pcd/display.ts';

// ============================================================================
// Input types
// ============================================================================

interface CreateQualityProfileInput {
	name: string;
	description: string | null;
	tags: string[];
	language: string | null;
}

interface CreateQualityProfileOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateQualityProfileInput;
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
 * Create a quality profile by writing an operation to the specified layer
 */
export async function create(options: CreateQualityProfileOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

	const queries = [];

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

	// 1. Insert the quality profile with default values
	const insertProfile = db
		.insertInto('quality_profiles')
		.values({
			name: input.name,
			description: input.description,
			upgrades_allowed: 1,
			minimum_custom_format_score: 0,
			upgrade_until_score: 0,
			upgrade_score_increment: 1
		})
		.compile();

	queries.push(insertProfile);

	const uniqueTags = Array.from(new Set(input.tags.map((tag) => tag.trim()).filter(Boolean)));

	// 2. Insert tags (create if not exist, then link)
	for (const tagName of uniqueTags) {
		// Insert tag if not exists
		const insertTag = db
			.insertInto('tags')
			.values({ name: tagName })
			.onConflict((oc) => oc.column('name').doNothing())
			.compile();

		queries.push(insertTag);

		// Link tag to quality profile using name-based FKs
		const linkTag = {
			sql: `INSERT INTO quality_profile_tags (quality_profile_name, tag_name) VALUES ('${esc(input.name)}', '${esc(tagName)}')`,
			parameters: [],
			query: {} as never
		};

		queries.push(linkTag);
	}

	// 3. Get all qualities and add them to the profile as individual items
	const allQualities = await db
		.selectFrom('qualities')
		.select(['id', 'name'])
		.orderBy('id')
		.execute();

	const allQualityNames = new Set(allQualities.map((quality) => quality.name));
	const enabledQualities = new Set(['Remux-1080p', 'Bluray-1080p']);
	const upgradeUntilName = 'Bluray-1080p';

	type OrderEntry =
		| { type: 'quality'; name: string }
		| { type: 'group'; name: string; members: string[] };

	const groupDefinitions = [
		{
			name: 'WEB 1080p',
			members: ['WEBDL-1080p', 'WEBRip-1080p'],
			enabled: false
		},
		{
			name: 'Pre-releases',
			members: ['REGIONAL', 'DVDSCR', 'TELECINE', 'TELESYNC', 'CAM', 'WORKPRINT'],
			enabled: false
		},
		{
			name: 'Unwanted',
			members: ['Unknown', 'Raw-HD', 'BR-DISK'],
			enabled: false
		}
	];
	const groupMap = new Map(groupDefinitions.map((group) => [group.name, group]));
	const groupAvailability = new Map(
		groupDefinitions.map((group) => [
			group.name,
			group.members.every((member) => allQualityNames.has(member))
		])
	);

	const desiredOrder: OrderEntry[] = [
		{ type: 'quality', name: 'Remux-2160p' },
		{ type: 'quality', name: 'Bluray-2160p' },
		{ type: 'quality', name: 'WEBDL-2160p' },
		{ type: 'quality', name: 'WEBRip-2160p' },
		{ type: 'quality', name: 'HDTV-2160p' },
		{ type: 'quality', name: 'Remux-1080p' },
		{ type: 'quality', name: 'Bluray-1080p' },
		{ type: 'group', name: 'WEB 1080p', members: ['WEBDL-1080p', 'WEBRip-1080p'] },
		{ type: 'quality', name: 'HDTV-1080p' },
		{ type: 'quality', name: 'Bluray-720p' },
		{ type: 'quality', name: 'WEBDL-720p' },
		{ type: 'quality', name: 'WEBRip-720p' },
		{ type: 'quality', name: 'HDTV-720p' },
		{ type: 'quality', name: 'Bluray-576p' },
		{ type: 'quality', name: 'Bluray-480p' },
		{ type: 'quality', name: 'WEBDL-480p' },
		{ type: 'quality', name: 'WEBRip-480p' },
		{ type: 'quality', name: 'HDTV-480p' },
		{ type: 'quality', name: 'DVD-R' },
		{ type: 'quality', name: 'DVD' },
		{ type: 'quality', name: 'SDTV' },
		{
			type: 'group',
			name: 'Pre-releases',
			members: ['REGIONAL', 'DVDSCR', 'TELECINE', 'TELESYNC', 'CAM', 'WORKPRINT']
		},
		{ type: 'group', name: 'Unwanted', members: ['Unknown', 'Raw-HD', 'BR-DISK'] }
	];

	const orderedItems: OrderedItem[] = [];
	const usedNames = new Set<string>();
	let position = 1;

	for (const entry of desiredOrder) {
		if (entry.type === 'group') {
			const group = groupMap.get(entry.name);
			const canGroup = groupAvailability.get(entry.name) ?? false;
			const members = group?.members ?? entry.members;

			if (!canGroup) {
				for (const member of members) {
					if (!allQualityNames.has(member) || usedNames.has(member)) continue;
					orderedItems.push({
						type: 'quality',
						name: member,
						position,
						enabled: false,
						upgradeUntil: false,
						members: []
					});
					usedNames.add(member);
					position += 1;
				}
				continue;
			}

			orderedItems.push({
				type: 'group',
				name: entry.name,
				position,
				enabled: group?.enabled ?? false,
				upgradeUntil: false,
				members: members.map((member) => ({ name: member }))
			});
			for (const member of members) {
				usedNames.add(member);
			}
			position += 1;
			continue;
		}

		if (!allQualityNames.has(entry.name) || usedNames.has(entry.name)) continue;
		orderedItems.push({
			type: 'quality',
			name: entry.name,
			position,
			enabled: enabledQualities.has(entry.name),
			upgradeUntil: entry.name === upgradeUntilName,
			members: []
		});
		usedNames.add(entry.name);
		position += 1;
	}

	for (const quality of allQualities) {
		if (usedNames.has(quality.name)) continue;
		orderedItems.push({
			type: 'quality',
			name: quality.name,
			position,
			enabled: false,
			upgradeUntil: false,
			members: []
		});
		position += 1;
	}

	const groupNames = orderedItems.filter((item) => item.type === 'group').map((item) => item.name);

	for (const groupName of groupNames) {
		const group = groupMap.get(groupName);
		if (!group) continue;
		const insertGroup = {
			sql: `INSERT INTO quality_groups (quality_profile_name, name) VALUES ('${esc(input.name)}', '${esc(groupName)}')`,
			parameters: [],
			query: {} as never
		};
		queries.push(insertGroup);

		for (let i = 0; i < group.members.length; i++) {
			const memberName = group.members[i];
			const insertMember = {
				sql: `INSERT INTO quality_group_members (quality_profile_name, quality_group_name, quality_name, position) VALUES ('${esc(input.name)}', '${esc(groupName)}', '${esc(memberName)}', ${i})`,
				parameters: [],
				query: {} as never
			};
			queries.push(insertMember);
		}
	}

	// Insert each quality/group into quality_profile_qualities with defaults
	for (const item of orderedItems) {
		const enabled = item.enabled ? 1 : 0;
		const upgradeUntil = item.upgradeUntil ? 1 : 0;
		const insertQuality = {
			sql: `INSERT INTO quality_profile_qualities (quality_profile_name, quality_name, quality_group_name, position, enabled, upgrade_until) VALUES ('${esc(input.name)}', ${
				item.type === 'quality' ? `'${esc(item.name)}'` : 'NULL'
			}, ${item.type === 'group' ? `'${esc(item.name)}'` : 'NULL'}, ${
				item.position
			}, ${enabled}, ${upgradeUntil})`,
			parameters: [],
			query: {} as never
		};
		queries.push(insertQuality);
	}

	// 4. Insert language if one is selected
	if (input.language !== null) {
		const insertLanguage = {
			sql: `INSERT INTO quality_profile_languages (quality_profile_name, language_name, type) VALUES ('${esc(input.name)}', '${esc(input.language)}', 'simple')`,
			parameters: [],
			query: {} as never
		};
		queries.push(insertLanguage);
	}

	// Write the operation
	const result = await writeOperation({
		databaseId,
		layer,
		description: `create-quality-profile-${input.name}`,
		queries,
		desiredState: {
			name: input.name,
			description: input.description ?? null,
			tags: uniqueTags,
			language: input.language ?? null
		},
		metadata: {
			operation: 'create',
			entity: 'quality_profile',
			name: input.name,
			stableKey: { key: 'quality_profile_name', value: input.name },
			summary: 'Create quality profile',
			title: `Create quality profile "${input.name}"`
		}
	});

	return result;
}
