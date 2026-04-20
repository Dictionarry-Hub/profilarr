import type { Migration } from '../migrations.ts';

/**
 * Migration 060: Drop app_info table
 *
 * Version was previously stored in app_info.version and read at runtime. It's
 * now baked into src/lib/shared/build.ts at Docker image build time, so the
 * table serves no purpose. The stored value was also never bumped by any
 * migration, so it was stale (`'2.0.0'`) regardless.
 *
 * The down migration recreates the table seeded with a literal '2.0.0' (its
 * historical initial value) so rollback to a pre-060 codebase finds what it
 * expects.
 */

export const migration: Migration = {
	version: 60,
	name: 'Drop app_info table',

	up: `
		DROP TABLE IF EXISTS app_info;
	`,

	down: `
		CREATE TABLE app_info (
			id INTEGER PRIMARY KEY CHECK (id = 1),
			version TEXT NOT NULL,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		INSERT INTO app_info (id, version) VALUES (1, '2.0.0');
	`
};
