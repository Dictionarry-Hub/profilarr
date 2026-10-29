import type { Migration } from '#db/migrations.ts';

/**
 * Migration 019: Change default log level to DEBUG
 */

export const migration: Migration = {
	version: 19,
	name: 'Change default log level to DEBUG',

	up: `
		UPDATE log_settings SET min_level = 'DEBUG' WHERE id = 1 AND min_level = 'INFO';
	`,

	down: `
		UPDATE log_settings SET min_level = 'INFO' WHERE id = 1 AND min_level = 'DEBUG';
	`
};
