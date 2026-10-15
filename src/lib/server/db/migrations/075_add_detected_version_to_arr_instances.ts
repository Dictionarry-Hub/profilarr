import type { Migration } from '../migrations.ts';

/**
 * Migration 075: Add detected version to arr_instances
 *
 * What the instance reported the last time Profilarr probed it: the app
 * version from system/status, the API generation the unversioned /api route
 * calls current, and when that probe ran. Sonarr v5 moved quality size limits
 * onto quality profile items, so sync and the UI need to know which
 * generation an instance speaks. All three stay NULL until the first probe.
 */

export const migration: Migration = {
	version: 75,
	name: 'Add detected version to arr_instances',

	up: `
		ALTER TABLE arr_instances ADD COLUMN detected_version TEXT;
		ALTER TABLE arr_instances ADD COLUMN detected_api TEXT;
		ALTER TABLE arr_instances ADD COLUMN detected_at TEXT;
	`,

	down: `
		ALTER TABLE arr_instances DROP COLUMN detected_version;
		ALTER TABLE arr_instances DROP COLUMN detected_api;
		ALTER TABLE arr_instances DROP COLUMN detected_at;
	`
};
