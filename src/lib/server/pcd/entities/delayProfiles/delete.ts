/**
 * Delete a delay profile operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { DelayProfilesRow } from '$shared/pcd/display.ts';

interface DeleteDelayProfileOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current profile data (for value guards) */
	current: DelayProfilesRow;
}

/**
 * Delete a delay profile by writing an operation to the specified layer
 *
 * Value guard by name only. Once the user has decided to delete, the other
 * field values don't matter — they're about to be gone. Matches the delete
 * contract used by every other entity.
 */
export async function remove(options: DeleteDelayProfileOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	const deleteProfileQuery = db
		.deleteFrom('delay_profiles')
		.where('name', '=', current.name)
		.compile();

	const result = await writeOperation({
		databaseId,
		layer,
		description: `delete-delay-profile-${current.name}`,
		queries: [deleteProfileQuery],
		desiredState: {
			deleted: true,
			name: current.name,
			preferred_protocol: current.preferred_protocol,
			usenet_delay: current.usenet_delay,
			torrent_delay: current.torrent_delay,
			bypass_if_highest_quality: current.bypass_if_highest_quality,
			bypass_if_above_custom_format_score: current.bypass_if_above_custom_format_score,
			minimum_custom_format_score: current.minimum_custom_format_score
		},
		metadata: {
			operation: 'delete',
			entity: 'delay_profile',
			name: current.name,
			stableKey: { key: 'delay_profile_name', value: current.name },
			changedFields: ['deleted'],
			summary: 'Delete delay profile',
			title: `Delete delay profile "${current.name}"`
		}
	});

	return result;
}
