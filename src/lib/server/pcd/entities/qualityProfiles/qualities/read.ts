/**
 * Quality profile qualities queries
 */

import { sql } from 'kysely';
import type { PCDCache } from '$pcd/index.ts';
import type { QualitiesPageData, OrderedItem, QualitiesGroup } from '$shared/pcd/display.ts';

/**
 * Get quality profile qualities data
 */
export async function qualities(
	cache: PCDCache,
	_databaseId: number,
	profileName: string
): Promise<QualitiesPageData> {
	const db = cache.kb;

	// 1. Get all qualities
	const allQualities = await db
		.selectFrom('qualities')
		.select(['name'])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	// 2. Get all groups for this profile
	const groups = await db
		.selectFrom('quality_groups')
		.select(['name'])
		.where('quality_profile_name', '=', profileName)
		.execute();

	// 3. Get group members
	const groupMembers = await db
		.selectFrom('quality_group_members')
		.innerJoin('qualities', 'qualities.name', 'quality_group_members.quality_name')
		.where('quality_group_members.quality_profile_name', '=', profileName)
		.select(['quality_group_members.quality_group_name', 'qualities.name as quality_name'])
		.execute();

	// Build groups with members
	const groupsMap = new Map<string, QualitiesGroup>();
	for (const group of groups) {
		groupsMap.set(group.name, {
			name: group.name,
			members: []
		});
	}

	for (const member of groupMembers) {
		const group = groupsMap.get(member.quality_group_name);
		if (group) {
			group.members.push({
				name: member.quality_name
			});
		}
	}

	// 4. Get ordered list (quality_profile_qualities)
	const orderedList = await db
		.selectFrom('quality_profile_qualities')
		.leftJoin('qualities', 'qualities.name', 'quality_profile_qualities.quality_name')
		.leftJoin('quality_groups', (join) =>
			join
				.onRef('quality_groups.name', '=', 'quality_profile_qualities.quality_group_name')
				.onRef(
					'quality_groups.quality_profile_name',
					'=',
					'quality_profile_qualities.quality_profile_name'
				)
		)
		.where('quality_profile_qualities.quality_profile_name', '=', profileName)
		.select([
			'quality_profile_qualities.quality_name',
			'quality_profile_qualities.quality_group_name',
			'quality_profile_qualities.position',
			'quality_profile_qualities.enabled',
			'quality_profile_qualities.upgrade_until',
			'qualities.name as resolved_quality_name',
			'quality_groups.name as group_name'
		])
		.orderBy('quality_profile_qualities.position')
		.execute();

	// Build ordered items
	const orderedItems: OrderedItem[] = orderedList.map((item) => {
		const isGroup = item.quality_group_name !== null;
		const name = isGroup ? item.group_name! : item.quality_name!;

		const orderedItem: OrderedItem = {
			type: isGroup ? 'group' : 'quality',
			name,
			position: item.position,
			enabled: item.enabled === 1,
			upgradeUntil: item.upgrade_until === 1
		};

		// Add members if it's a group
		if (isGroup) {
			const group = groupsMap.get(name);
			orderedItem.members = group?.members || [];
		}

		return orderedItem;
	});

	// 5. Find available qualities (not in ordered list and not in any group)
	const usedQualityNames = new Set<string>();

	// Mark qualities in ordered list
	for (const item of orderedItems) {
		if (item.type === 'quality') {
			usedQualityNames.add(item.name);
		} else {
			// Mark all members of groups as used
			item.members?.forEach((member) => usedQualityNames.add(member.name));
		}
	}

	const availableQualities = allQualities
		.filter((q) => !usedQualityNames.has(q.name))
		.map((q) => ({ name: q.name }));

	return {
		orderedItems,
		availableQualities,
		allQualities: allQualities.map((q) => ({ name: q.name })),
		groups: Array.from(groupsMap.values())
	};
}
