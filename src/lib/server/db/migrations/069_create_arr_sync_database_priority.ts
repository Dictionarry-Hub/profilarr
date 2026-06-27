import type { Migration } from '../migrations.ts';

/**
 * Migration 069: Create arr_sync_database_priority
 *
 * Stores a priority ordering of databases per Arr instance for quality profile
 * sync. When multiple databases are selected, the syncer processes them from
 * lowest priority to highest so the highest-priority database's entities win.
 *
 * Seeded with every (instance, database) pair so the table is always fully
 * populated. Priority 1 is highest.
 */

export const migration: Migration = {
	version: 69,
	name: 'Create arr sync database priority',

	up: `
		CREATE TABLE arr_sync_database_priority (
			instance_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			priority INTEGER NOT NULL,
			PRIMARY KEY (instance_id, database_id),
			FOREIGN KEY (instance_id) REFERENCES arr_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);

		INSERT INTO arr_sync_database_priority (instance_id, database_id, priority)
		SELECT ai.id, di.id, ROW_NUMBER() OVER (PARTITION BY ai.id ORDER BY di.id)
		FROM arr_instances ai
		CROSS JOIN database_instances di;
	`,

	down: `
		DROP TABLE IF EXISTS arr_sync_database_priority;
	`
};
