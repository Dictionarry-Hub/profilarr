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
 * Uses value guards to detect conflicts with upstream changes
 */
export async function remove(options: DeleteDelayProfileOptions) {
	const { databaseId, cache, layer, current } = options;
	const db = cache.kb;

	// Delete the delay profile with value guards
	let deleteProfile = db
		.deleteFrom('delay_profiles')
		// Value guard - ensure this is the profile we expect
		.where('name', '=', current.name)
		.where('preferred_protocol', '=', current.preferred_protocol)
		.where('bypass_if_highest_quality', '=', current.bypass_if_highest_quality ? 1 : 0)
		.where(
			'bypass_if_above_custom_format_score',
			'=',
			current.bypass_if_above_custom_format_score ? 1 : 0
		);

	if (current.usenet_delay === null) {
		deleteProfile = deleteProfile.where('usenet_delay', 'is', null);
	} else {
		deleteProfile = deleteProfile.where('usenet_delay', '=', current.usenet_delay);
	}
	if (current.torrent_delay === null) {
		deleteProfile = deleteProfile.where('torrent_delay', 'is', null);
	} else {
		deleteProfile = deleteProfile.where('torrent_delay', '=', current.torrent_delay);
	}
	if (current.minimum_custom_format_score === null) {
		deleteProfile = deleteProfile.where('minimum_custom_format_score', 'is', null);
	} else {
		deleteProfile = deleteProfile.where(
			'minimum_custom_format_score',
			'=',
			current.minimum_custom_format_score
		);
	}

	const deleteProfileQuery = deleteProfile.compile();

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
