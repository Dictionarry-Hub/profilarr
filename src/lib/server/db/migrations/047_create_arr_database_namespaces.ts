import type { Migration } from '#db/migrations.ts';

/**
 * Migration 047: Create arr_database_namespaces table
 *
 * Stores a per-(Arr instance, database) namespace index used to generate
 * zero-width Unicode suffixes for CF and QP names during sync. This prevents
 * name collisions when multiple databases are synced to the same Arr instance
 * and enables cleanup detection (#179).
 */

export const migration: Migration = {
	version: 47,
	name: 'Create arr_database_namespaces table',

	up: `
		CREATE TABLE arr_database_namespaces (
			instance_id    INTEGER NOT NULL,
			database_id    INTEGER NOT NULL,
			namespace_index INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id),
			UNIQUE (instance_id, namespace_index),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);
	`,

	down: `DROP TABLE IF EXISTS arr_database_namespaces;`
};
