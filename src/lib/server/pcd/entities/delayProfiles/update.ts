/**
 * Update a delay profile operation
 */

import type { PCDCache } from '$pcd/index.ts';
import { writeOperation, type OperationLayer } from '$pcd/index.ts';
import type { DelayProfilesRow, PreferredProtocol } from '$shared/pcd/display.ts';
import { logger } from '$logger/logger.ts';

interface UpdateDelayProfileInput {
	name: string;
	preferredProtocol: PreferredProtocol;
	usenetDelay: number;
	torrentDelay: number;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCfScore: boolean;
	minimumCfScore: number;
}

interface UpdateDelayProfileOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	/** The current profile data (for value guards) */
	current: DelayProfilesRow;
	/** The new values */
	input: UpdateDelayProfileInput;
}

/**
 * Update a delay profile by writing an operation to the specified layer
 * Uses value guards to detect conflicts with upstream changes
 */
export async function update(options: UpdateDelayProfileOptions) {
	const { databaseId, cache, layer, current, input } = options;
	const db = cache.kb;

	if (input.name !== current.name) {
		const existing = await db
			.selectFrom('delay_profiles')
			.where((eb) => eb(eb.fn('lower', [eb.ref('name')]), '=', input.name.toLowerCase()))
			.select('name')
			.executeTakeFirst();

		if (existing) {
			await logger.warn(`Duplicate delay profile name "${input.name}"`, {
				source: 'DelayProfile',
				meta: { databaseId, name: input.name }
			});
			throw new Error(`A delay profile with name "${input.name}" already exists`);
		}
	}

	// Determine delay values based on protocol (schema has CHECK constraints)
	// only_torrent -> usenet_delay must be NULL
	// only_usenet -> torrent_delay must be NULL
	const usenetDelay = input.preferredProtocol === 'only_torrent' ? null : input.usenetDelay;
	const torrentDelay = input.preferredProtocol === 'only_usenet' ? null : input.torrentDelay;

	// minimum_custom_format_score must be NULL if bypass_if_above_custom_format_score is false
	const minimumCfScore = input.bypassIfAboveCfScore ? input.minimumCfScore : null;

	// Update the delay profile with value guards
	const setValues: Record<string, unknown> = {};

	if (current.name !== input.name) {
		setValues.name = input.name;
	}
	if (current.preferred_protocol !== input.preferredProtocol) {
		setValues.preferred_protocol = input.preferredProtocol;
	}
	if (current.usenet_delay !== usenetDelay) {
		setValues.usenet_delay = usenetDelay;
	}
	if (current.torrent_delay !== torrentDelay) {
		setValues.torrent_delay = torrentDelay;
	}
	if (current.bypass_if_highest_quality !== input.bypassIfHighestQuality) {
		setValues.bypass_if_highest_quality = input.bypassIfHighestQuality ? 1 : 0;
	}
	if (current.bypass_if_above_custom_format_score !== input.bypassIfAboveCfScore) {
		setValues.bypass_if_above_custom_format_score = input.bypassIfAboveCfScore ? 1 : 0;
	}
	if (current.minimum_custom_format_score !== minimumCfScore) {
		setValues.minimum_custom_format_score = minimumCfScore;
	}

	let updateProfile = db
		.updateTable('delay_profiles')
		.set(setValues)
		// Value guard - ensure this is the profile we expect
		.where('name', '=', current.name);

	if (current.preferred_protocol !== input.preferredProtocol) {
		updateProfile = updateProfile.where('preferred_protocol', '=', current.preferred_protocol);
	}
	if (current.usenet_delay !== usenetDelay) {
		if (current.usenet_delay === null) {
			updateProfile = updateProfile.where('usenet_delay', 'is', null);
		} else {
			updateProfile = updateProfile.where('usenet_delay', '=', current.usenet_delay);
		}
	}
	if (current.torrent_delay !== torrentDelay) {
		if (current.torrent_delay === null) {
			updateProfile = updateProfile.where('torrent_delay', 'is', null);
		} else {
			updateProfile = updateProfile.where('torrent_delay', '=', current.torrent_delay);
		}
	}
	if (current.bypass_if_highest_quality !== input.bypassIfHighestQuality) {
		updateProfile = updateProfile.where(
			'bypass_if_highest_quality',
			'=',
			current.bypass_if_highest_quality ? 1 : 0
		);
	}
	if (current.bypass_if_above_custom_format_score !== input.bypassIfAboveCfScore) {
		updateProfile = updateProfile.where(
			'bypass_if_above_custom_format_score',
			'=',
			current.bypass_if_above_custom_format_score ? 1 : 0
		);
	}
	if (current.minimum_custom_format_score !== minimumCfScore) {
		if (current.minimum_custom_format_score === null) {
			updateProfile = updateProfile.where('minimum_custom_format_score', 'is', null);
		} else {
			updateProfile = updateProfile.where(
				'minimum_custom_format_score',
				'=',
				current.minimum_custom_format_score
			);
		}
	}

	const updateProfileQuery = Object.keys(setValues).length > 0 ? updateProfile.compile() : null;

	// Log what's being changed
	const changes: Record<string, { from: unknown; to: unknown }> = {};

	if (current.name !== input.name) {
		changes.name = { from: current.name, to: input.name };
	}
	if (current.preferred_protocol !== input.preferredProtocol) {
		changes.preferredProtocol = { from: current.preferred_protocol, to: input.preferredProtocol };
	}
	if (current.usenet_delay !== usenetDelay) {
		changes.usenetDelay = { from: current.usenet_delay, to: usenetDelay };
	}
	if (current.torrent_delay !== torrentDelay) {
		changes.torrentDelay = { from: current.torrent_delay, to: torrentDelay };
	}
	if (current.bypass_if_highest_quality !== input.bypassIfHighestQuality) {
		changes.bypassIfHighestQuality = {
			from: current.bypass_if_highest_quality,
			to: input.bypassIfHighestQuality
		};
	}
	if (current.bypass_if_above_custom_format_score !== input.bypassIfAboveCfScore) {
		changes.bypassIfAboveCfScore = {
			from: current.bypass_if_above_custom_format_score,
			to: input.bypassIfAboveCfScore
		};
	}
	if (current.minimum_custom_format_score !== minimumCfScore) {
		changes.minimumCfScore = { from: current.minimum_custom_format_score, to: minimumCfScore };
	}

	if (!updateProfileQuery) {
		return { success: true };
	}

	await logger.info(`Save delay profile "${input.name}"`, {
		source: 'DelayProfile',
		meta: {
			id: current.id,
			changes
		}
	});

	// Write the operation with metadata
	const isRename = input.name !== current.name;
	const changedFields = Object.keys(changes);
	const desiredState: Record<string, unknown> = {};
	if (changes.name) {
		desiredState.name = { from: current.name, to: input.name };
	}
	if (changes.preferredProtocol) {
		desiredState.preferred_protocol = {
			from: current.preferred_protocol,
			to: input.preferredProtocol
		};
	}
	if (changes.usenetDelay) {
		desiredState.usenet_delay = { from: current.usenet_delay, to: usenetDelay };
	}
	if (changes.torrentDelay) {
		desiredState.torrent_delay = { from: current.torrent_delay, to: torrentDelay };
	}
	if (changes.bypassIfHighestQuality) {
		desiredState.bypass_if_highest_quality = {
			from: current.bypass_if_highest_quality,
			to: input.bypassIfHighestQuality
		};
	}
	if (changes.bypassIfAboveCfScore) {
		desiredState.bypass_if_above_custom_format_score = {
			from: current.bypass_if_above_custom_format_score,
			to: input.bypassIfAboveCfScore
		};
	}
	if (changes.minimumCfScore) {
		desiredState.minimum_custom_format_score = {
			from: current.minimum_custom_format_score,
			to: minimumCfScore
		};
	}

	const result = await writeOperation({
		databaseId,
		layer,
		description: `update-delay-profile-${input.name}`,
		queries: [updateProfileQuery],
		desiredState,
		metadata: {
			operation: 'update',
			entity: 'delay_profile',
			name: input.name,
			...(isRename && { previousName: current.name }),
			stableKey: { key: 'delay_profile_name', value: current.name },
			changedFields,
			summary: 'Update delay profile',
			title: `Update delay profile "${input.name}"`
		}
	});

	return result;
}
