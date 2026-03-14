import { error, fail } from '@sveltejs/kit';
import type { ServerLoad, Actions } from '@sveltejs/kit';
import { pcdManager } from '$pcd/core/manager.ts';
import { canWriteToBase } from '$pcd/ops/writer.ts';
import * as qualityProfileQueries from '$pcd/entities/qualityProfiles/index.ts';
import type { OperationLayer } from '$pcd/core/types.ts';
import { getAffectedArrs } from '$lib/server/sync/affectedArrs.ts';
import { hasQualityGroupMembersPositionInCache } from '$pcd/entities/qualityProfiles/qualities/groupMembersSchema.ts';

type OrderedItem = {
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: boolean;
	upgradeUntil: boolean;
	members?: Array<{ name: string }>;
};

function hasBlockedGroupMembershipChanges(
	currentItems: OrderedItem[],
	nextItems: OrderedItem[]
): boolean {
	const currentGroups = new Map(
		currentItems
			.filter((item) => item.type === 'group')
			.map((item) => [item.name, (item.members ?? []).map((member) => member.name)])
	);
	const nextGroups = new Map(
		nextItems
			.filter((item) => item.type === 'group')
			.map((item) => [item.name, (item.members ?? []).map((member) => member.name)])
	);

	for (const [name, nextMembers] of nextGroups) {
		const currentMembers = currentGroups.get(name);
		if (!currentMembers) return true;
		if (currentMembers.length !== nextMembers.length) return true;
		if (currentMembers.some((member, index) => member !== nextMembers[index])) return true;
	}

	return false;
}

export const load: ServerLoad = async ({ params }) => {
	const { databaseId, id } = params;

	// Validate params exist
	if (!databaseId || !id) {
		throw error(400, 'Missing required parameters');
	}

	// Parse and validate the database ID
	const currentDatabaseId = parseInt(databaseId, 10);
	if (isNaN(currentDatabaseId)) {
		throw error(400, 'Invalid database ID');
	}

	// Parse and validate the profile ID
	const profileId = parseInt(id, 10);
	if (isNaN(profileId)) {
		throw error(400, 'Invalid profile ID');
	}

	// Get the cache for the database
	const cache = pcdManager.getCache(currentDatabaseId);
	if (!cache) {
		throw error(500, 'Database cache not available');
	}

	// Get profile name from ID
	const profile = await cache.kb
		.selectFrom('quality_profiles')
		.select('name')
		.where('id', '=', profileId)
		.executeTakeFirst();

	if (!profile) {
		throw error(404, 'Quality profile not found');
	}

	const qualitiesData = await qualityProfileQueries.qualities(
		cache,
		currentDatabaseId,
		profile.name
	);

	const canEditGroupMembers = hasQualityGroupMembersPositionInCache(cache);

	return {
		qualities: qualitiesData,
		profileName: profile.name,
		canWriteToBase: canWriteToBase(currentDatabaseId),
		canEditGroupMembers
	};
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const { databaseId, id } = params;

		if (!databaseId || !id) {
			return fail(400, { error: 'Missing required parameters' });
		}

		const currentDatabaseId = parseInt(databaseId, 10);
		if (isNaN(currentDatabaseId)) {
			return fail(400, { error: 'Invalid database ID' });
		}

		const profileId = parseInt(id, 10);
		if (isNaN(profileId)) {
			return fail(400, { error: 'Invalid profile ID' });
		}

		const cache = pcdManager.getCache(currentDatabaseId);
		if (!cache) {
			return fail(500, { error: 'Database cache not available' });
		}

		const formData = await request.formData();

		// Parse form data
		const layer = (formData.get('layer') as OperationLayer) || 'user';
		const orderedItemsJson = formData.get('orderedItems') as string;

		// Check layer permission
		if (layer === 'base' && !canWriteToBase(currentDatabaseId)) {
			return fail(403, { error: 'Cannot write to base layer without personal access token' });
		}

		// Parse ordered items
		let orderedItems: OrderedItem[] = [];
		try {
			orderedItems = JSON.parse(orderedItemsJson || '[]');
		} catch {
			return fail(400, { error: 'Invalid ordered items format' });
		}

		// Validate: only one item can have upgradeUntil set to true
		const upgradeUntilCount = orderedItems.filter((item) => item.upgradeUntil).length;
		if (upgradeUntilCount > 1) {
			return fail(400, { error: 'Only one quality can be marked as "upgrade until"' });
		}

		// Get profile name for metadata
		const profile = await cache.kb
			.selectFrom('quality_profiles')
			.select('name')
			.where('id', '=', profileId)
			.executeTakeFirst();

		if (!profile) {
			return fail(404, { error: 'Quality profile not found' });
		}

		if (!hasQualityGroupMembersPositionInCache(cache)) {
			const currentQualities = await qualityProfileQueries.qualities(
				cache,
				currentDatabaseId,
				profile.name
			);
			if (
				hasBlockedGroupMembershipChanges(
					currentQualities.orderedItems as OrderedItem[],
					orderedItems
				)
			) {
				return fail(400, {
					error:
						'This database uses an older schema. Update the schema dependency before editing quality group members.'
				});
			}
		}

		// Update the qualities
		let result;
		try {
			result = await qualityProfileQueries.updateQualities({
				databaseId: currentDatabaseId,
				cache,
				layer,
				profileName: profile.name,
				input: {
					orderedItems
				}
			});
		} catch (err) {
			const message = err instanceof Error ? err.message : 'Failed to update qualities';
			if (message.toLowerCase().includes('upgrade until')) {
				return fail(400, { error: message });
			}
			return fail(500, { error: message });
		}

		if (!result.success) {
			return fail(500, { error: result.error || 'Failed to update qualities' });
		}

		const affectedArrs = getAffectedArrs({
			entityType: 'qualityProfile',
			databaseId: currentDatabaseId,
			entityName: profile.name
		});

		return {
			success: true,
			redirectTo: `/quality-profiles/${databaseId}/${id}/qualities`,
			affectedArrs
		};
	}
};
