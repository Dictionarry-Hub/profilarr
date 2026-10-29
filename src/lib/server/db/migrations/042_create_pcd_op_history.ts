import type { Migration } from '#db/migrations.ts';

/**
 * Migration 042: Create pcd_op_history table
 *
 * Tracks status/results for each op per apply/compile batch.
 */

export const migration: Migration = {
	version: 42,
	name: 'Create pcd_op_history table',

	up: `
		CREATE TABLE pcd_op_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			op_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			batch_id TEXT NOT NULL,
			status TEXT NOT NULL CHECK (
				status IN ('applied', 'skipped', 'conflicted', 'conflicted_pending', 'error', 'dropped', 'superseded')
			),
			rowcount INTEGER,
			conflict_reason TEXT,
			error TEXT,
			details TEXT,
			applied_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			FOREIGN KEY (op_id) REFERENCES pcd_ops(id) ON DELETE CASCADE,
			FOREIGN KEY (database_id) REFERENCES database_instances(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_pcd_op_history_status
			ON pcd_op_history(database_id, status, applied_at);

		CREATE INDEX idx_pcd_op_history_op
			ON pcd_op_history(op_id, applied_at);
	`,

	down: `
		DROP INDEX IF EXISTS idx_pcd_op_history_op;
		DROP INDEX IF EXISTS idx_pcd_op_history_status;
		DROP TABLE IF EXISTS pcd_op_history;
	`
};
