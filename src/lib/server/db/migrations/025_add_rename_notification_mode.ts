import type { Migration } from '#db/migrations.ts';

/**
 * Migration 025: Add summary_notifications to arr_rename_settings
 *
 * Adds a boolean column to control whether rename notifications are sent as
 * summaries (default) or rich notifications with all file details.
 *
 * - 1 (default): Summary notification with total count and one sample item
 * - 0: Rich notification with all renamed files listed
 */

export const migration: Migration = {
	version: 25,
	name: 'Add summary_notifications to arr_rename_settings',

	up: `
		ALTER TABLE arr_rename_settings ADD COLUMN summary_notifications INTEGER NOT NULL DEFAULT 1;
	`,

	down: `
		ALTER TABLE arr_rename_settings DROP COLUMN summary_notifications;
	`
};
