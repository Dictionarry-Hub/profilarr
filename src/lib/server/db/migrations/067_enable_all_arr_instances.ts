import type { Migration } from '../migrations.ts';

/**
 * Migration 067: Enable all Arr instances
 *
 * Arr instances are always active. This preserves existing rows by enabling any
 * instance that had previously been disabled.
 */

export const migration: Migration = {
	version: 67,
	name: 'Enable all Arr instances',

	up: `
		UPDATE arr_instances
		SET enabled = 1,
			updated_at = CURRENT_TIMESTAMP
		WHERE enabled = 0;
	`,

	down: `
		-- Previous disabled state cannot be reconstructed.
		SELECT 1;
	`
};
