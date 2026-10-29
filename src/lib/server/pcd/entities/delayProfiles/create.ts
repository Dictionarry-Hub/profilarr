/**
 * Create a delay profile operation
 */

import type { PCDCache } from '#pcd/index.ts';
import { writeOperation, type OperationLayer } from '#pcd/index.ts';
import { logger } from '#logger/logger.ts';
import type { PreferredProtocol } from '#shared/pcd/display.ts';

interface CreateDelayProfileInput {
	name: string;
	preferredProtocol: PreferredProtocol;
	usenetDelay: number;
	torrentDelay: number;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCfScore: boolean;
	minimumCfScore: number;
}

interface CreateDelayProfileOptions {
	databaseId: number;
	cache: PCDCache;
	layer: OperationLayer;
	input: CreateDelayProfileInput;
}

/**
 * Create a delay profile by writing an operation to the specified layer
 */
export async function create(options: CreateDelayProfileOptions) {
	const { databaseId, cache, layer, input } = options;
	const db = cache.kb;

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

	// Determine delay values based on protocol (schema has CHECK constraints)
	// only_torrent -> usenet_delay must be NULL
	// only_usenet -> torrent_delay must be NULL
	const usenetDelay = input.preferredProtocol === 'only_torrent' ? null : input.usenetDelay;
	const torrentDelay = input.preferredProtocol === 'only_usenet' ? null : input.torrentDelay;

	// minimum_custom_format_score must be NULL if bypass_if_above_custom_format_score is false
	const minimumCfScore = input.bypassIfAboveCfScore ? input.minimumCfScore : null;

	const insertProfile = db
		.insertInto('delay_profiles')
		.values({
			name: input.name,
			preferred_protocol: input.preferredProtocol,
			usenet_delay: usenetDelay,
			torrent_delay: torrentDelay,
			bypass_if_highest_quality: input.bypassIfHighestQuality ? 1 : 0,
			bypass_if_above_custom_format_score: input.bypassIfAboveCfScore ? 1 : 0,
			minimum_custom_format_score: minimumCfScore
		})
		.compile();

	const result = await writeOperation({
		databaseId,
		layer,
		description: `create-delay-profile-${input.name}`,
		queries: [insertProfile],
		desiredState: {
			name: input.name,
			preferred_protocol: input.preferredProtocol,
			usenet_delay: usenetDelay,
			torrent_delay: torrentDelay,
			bypass_if_highest_quality: input.bypassIfHighestQuality,
			bypass_if_above_custom_format_score: input.bypassIfAboveCfScore,
			minimum_custom_format_score: minimumCfScore
		},
		metadata: {
			operation: 'create',
			entity: 'delay_profile',
			name: input.name,
			stableKey: { key: 'delay_profile_name', value: input.name },
			summary: 'Create delay profile',
			title: `Create delay profile "${input.name}"`
		}
	});

	return result;
}
