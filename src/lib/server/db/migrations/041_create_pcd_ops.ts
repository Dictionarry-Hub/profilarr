import type { Migration } from '#db/migrations.ts';

/**
 * Migration 041: Create pcd_ops table
 *
 * Stores all PCD operations in the local database (base + user).
 *
 * Example rows (illustrative):
 * 1) Base published (from repo)
 *    { database_id: 1, origin: 'base', state: 'published', source: 'repo',
 *      filename: '12.add-hdr10.sql', op_number: 12, sequence: 12,
 *      sql: 'UPDATE ...', metadata: '{"operation":"update","entity":"custom_format","name":"HDR10"}' }
 * 2) Base published (from repo)
 *    { database_id: 1, origin: 'base', state: 'published', source: 'repo',
 *      filename: '13.add-dv.sql', op_number: 13, sequence: 13,
 *      sql: 'INSERT ...', metadata: '{"operation":"create","entity":"custom_format","name":"Dolby Vision"}' }
 * 3) Base draft (local, not pushed)
 *    { database_id: 1, origin: 'base', state: 'draft', source: 'local',
 *      filename: NULL, op_number: NULL, sequence: 1001,
 *      sql: 'UPDATE ...', metadata: '{"operation":"update","entity":"quality_profile","name":"1080p"}' }
 * 4) User op (local override)
 *    { database_id: 1, origin: 'user', state: 'published', source: 'local',
 *      filename: NULL, op_number: NULL, sequence: 2001,
 *      sql: 'UPDATE ...', metadata: '{"operation":"update","entity":"quality_profile","name":"1080p"}' }
 * 5) User op (local create)
 *    { database_id: 1, origin: 'user', state: 'published', source: 'local',
 *      filename: NULL, op_number: NULL, sequence: 2002,
 *      sql: 'INSERT ...', metadata: '{"operation":"create","entity":"regular_expression","name":"Release Group - SPARKS"}' }
 */

export const migration: Migration = {
	version: 41,
	name: 'Create pcd_ops table',

	up: `
		CREATE TABLE pcd_ops (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			database_id INTEGER NOT NULL,
			origin TEXT NOT NULL CHECK (origin IN ('base', 'user')),
			state TEXT NOT NULL CHECK (state IN ('published', 'draft', 'superseded', 'dropped', 'orphaned')),
			source TEXT NOT NULL CHECK (source IN ('repo', 'local', 'import')),
			filename TEXT,
			op_number INTEGER,
			sequence INTEGER,
			sql TEXT NOT NULL,
			metadata TEXT,
			desired_state TEXT,
			content_hash TEXT,
			last_seen_in_repo_at DATETIME,
			superseded_by_op_id INTEGER,
			pushed_at DATETIME,
			pushed_commit TEXT,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE,
			FOREIGN KEY (superseded_by_op_id) REFERENCES pcd_ops(id)
		);

		CREATE INDEX idx_pcd_ops_apply_order
			ON pcd_ops(database_id, origin, state, sequence, id);

		CREATE UNIQUE INDEX idx_pcd_ops_base_filename
			ON pcd_ops(database_id, origin, filename)
			WHERE origin = 'base' AND filename IS NOT NULL;

		CREATE INDEX idx_pcd_ops_hash
			ON pcd_ops(database_id, origin, content_hash);
	`,

	down: `
		DROP INDEX IF EXISTS idx_pcd_ops_hash;
		DROP INDEX IF EXISTS idx_pcd_ops_base_filename;
		DROP INDEX IF EXISTS idx_pcd_ops_apply_order;
		DROP TABLE IF EXISTS pcd_ops;
	`
};
