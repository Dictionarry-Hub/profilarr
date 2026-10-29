import type { Migration } from '#db/migrations.ts';
import { db } from '#db/db.ts';

/**
 * Migration 031: Remove searchCooldown from filter configs
 *
 * The cooldown system is being simplified to use filter-level tags
 * instead of time-based cooldowns. This migration removes the
 * searchCooldown field from all existing filter configurations.
 */

interface LegacyFilterConfig {
	id: string;
	name: string;
	enabled: boolean;
	group: unknown;
	selector: string;
	count: number;
	cutoff: number;
	searchCooldown?: number; // Field being removed
}

interface UpgradeConfigRow {
	id: number;
	filters: string;
}

/**
 * Remove searchCooldown from filter configs
 */
function migrateFilterConfigs(): void {
	const rows = db.query<UpgradeConfigRow>('SELECT id, filters FROM upgrade_configs');

	for (const row of rows) {
		try {
			const filters = JSON.parse(row.filters) as LegacyFilterConfig[];
			let modified = false;

			const updatedFilters = filters.map((filter) => {
				if ('searchCooldown' in filter) {
					modified = true;
					const { searchCooldown: _, ...rest } = filter;
					return rest;
				}
				return filter;
			});

			if (modified) {
				db.execute(
					'UPDATE upgrade_configs SET filters = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
					JSON.stringify(updatedFilters),
					row.id
				);
			}
		} catch {
			// Skip rows with invalid JSON - shouldn't happen but be safe
		}
	}
}

export const migration: Migration = {
	version: 31,
	name: 'Remove searchCooldown from filter configs',

	up: `
		-- Data migration handled by afterUp callback
		SELECT 1;
	`,

	down: `
		-- Cannot restore removed searchCooldown values
		SELECT 1;
	`,

	afterUp: migrateFilterConfigs
};
