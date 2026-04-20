import type { Migration } from '../migrations.ts';

/**
 * Migration 059: Add external_url to arr_instances
 *
 * Optional browser-facing URL for "Open in Radarr/Sonarr" links. When set,
 * the UI uses external_url for display links while Profilarr's backend
 * continues to call the instance using `url`. Lets users behind a reverse
 * proxy with SSO/OIDC point the backend at an internal hostname and the
 * browser at the external one.
 */

export const migration: Migration = {
	version: 59,
	name: 'Add external_url to arr_instances',

	up: `
		ALTER TABLE arr_instances ADD COLUMN external_url TEXT;
	`,

	down: `
		ALTER TABLE arr_instances DROP COLUMN external_url;
	`
};
