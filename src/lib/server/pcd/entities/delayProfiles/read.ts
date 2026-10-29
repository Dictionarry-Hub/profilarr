/**
 * Delay profile read operations
 */

/**
 * Delay profile read operations
 */

import { sql } from 'kysely';
import type { PCDCache } from '#pcd/index.ts';
import type { DelayProfilesRow, PreferredProtocol } from '#shared/pcd/display.ts';

/**
 * Convert a database row to DelayProfilesRow with boolean conversion.
 * SQLite returns 0/1 for booleans, we convert to true/false.
 */
function toDelayProfile(row: {
	id: number;
	name: string;
	preferred_protocol: string;
	usenet_delay: number | null;
	torrent_delay: number | null;
	bypass_if_highest_quality: number;
	bypass_if_above_custom_format_score: number;
	minimum_custom_format_score: number | null;
	created_at: string;
	updated_at: string;
}): DelayProfilesRow {
	return {
		id: row.id,
		name: row.name,
		preferred_protocol: row.preferred_protocol as PreferredProtocol,
		usenet_delay: row.usenet_delay,
		torrent_delay: row.torrent_delay,
		bypass_if_highest_quality: row.bypass_if_highest_quality === 1,
		bypass_if_above_custom_format_score: row.bypass_if_above_custom_format_score === 1,
		minimum_custom_format_score: row.minimum_custom_format_score,
		created_at: row.created_at,
		updated_at: row.updated_at
	};
}

/**
 * Get all delay profiles ordered by name
 */
export async function list(cache: PCDCache): Promise<DelayProfilesRow[]> {
	const db = cache.kb;

	const profiles = await db
		.selectFrom('delay_profiles')
		.select([
			'id',
			'name',
			'preferred_protocol',
			'usenet_delay',
			'torrent_delay',
			'bypass_if_highest_quality',
			'bypass_if_above_custom_format_score',
			'minimum_custom_format_score',
			'created_at',
			'updated_at'
		])
		.orderBy(sql`name COLLATE NOCASE`)
		.execute();

	return profiles.map(toDelayProfile);
}

/**
 * Get a single delay profile by ID
 */
export async function get(cache: PCDCache, id: number): Promise<DelayProfilesRow | null> {
	const db = cache.kb;

	const profile = await db
		.selectFrom('delay_profiles')
		.select([
			'id',
			'name',
			'preferred_protocol',
			'usenet_delay',
			'torrent_delay',
			'bypass_if_highest_quality',
			'bypass_if_above_custom_format_score',
			'minimum_custom_format_score',
			'created_at',
			'updated_at'
		])
		.where('id', '=', id)
		.executeTakeFirst();

	if (!profile) return null;

	return toDelayProfile(profile);
}

/**
 * Get a single delay profile by name
 */
export async function getByName(cache: PCDCache, name: string): Promise<DelayProfilesRow | null> {
	const db = cache.kb;

	const profile = await db
		.selectFrom('delay_profiles')
		.select([
			'id',
			'name',
			'preferred_protocol',
			'usenet_delay',
			'torrent_delay',
			'bypass_if_highest_quality',
			'bypass_if_above_custom_format_score',
			'minimum_custom_format_score',
			'created_at',
			'updated_at'
		])
		.where('name', '=', name)
		.executeTakeFirst();

	if (!profile) return null;

	return toDelayProfile(profile);
}
