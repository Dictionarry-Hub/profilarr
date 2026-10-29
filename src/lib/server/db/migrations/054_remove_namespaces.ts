import type { Migration } from '#db/migrations.ts';

/**
 * Migration 054: Remove namespace system
 *
 * Drops arr_database_namespaces (zero-width Unicode suffix tracking).
 * Cleanup now compares Arr state directly against sync selections.
 */

export const migration: Migration = {
	version: 54,
	name: 'Remove namespace system',

	up: `
		DROP TABLE IF EXISTS arr_database_namespaces;
	`,

	down: `
		CREATE TABLE arr_database_namespaces (
			instance_id    INTEGER NOT NULL,
			database_id    INTEGER NOT NULL,
			namespace_index INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id),
			UNIQUE (instance_id, namespace_index),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);
	`
};
