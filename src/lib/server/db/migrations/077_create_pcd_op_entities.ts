import type { Migration } from '../migrations.ts';

/**
 * Migration 077: Create pcd_op_entities table
 *
 * Records the entities each user op targets or depends on (#367), so local
 * changes history can look them up by entity instead of parsing op metadata.
 * Renames keep the old name in previous_name. Rows stay with dropped and
 * superseded ops, so live lookups must join pcd_ops on state = 'published'.
 *
 * Backfills existing user ops from their metadata using the same rules as
 * entityRowsFromMetadata, skipping any without an entity or name.
 */

export const migration: Migration = {
	version: 77,
	name: 'Create pcd_op_entities table',

	up: `
		CREATE TABLE pcd_op_entities (
			op_id INTEGER NOT NULL,
			database_id INTEGER NOT NULL,
			entity TEXT NOT NULL,
			name TEXT NOT NULL,
			previous_name TEXT,
			role TEXT NOT NULL CHECK (role IN ('target', 'prerequisite')),
			PRIMARY KEY (op_id, entity, name, role),
			FOREIGN KEY (op_id) REFERENCES pcd_ops(id) ON DELETE CASCADE
		);

		CREATE INDEX idx_pcd_op_entities_lookup
			ON pcd_op_entities(database_id, entity, name);

		INSERT OR IGNORE INTO pcd_op_entities (op_id, database_id, entity, name, previous_name, role)
		SELECT id, database_id, entity, target_name, previous_name, 'target'
		FROM (
			SELECT
				id,
				database_id,
				NULLIF(json_extract(metadata, '$.entity'), '') AS entity,
				CASE
					WHEN NULLIF(json_extract(metadata, '$.previousName'), '') IS NOT NULL
						THEN NULLIF(json_extract(metadata, '$.name'), '')
					ELSE COALESCE(
						NULLIF(json_extract(metadata, '$.stable_key.value'), ''),
						NULLIF(json_extract(metadata, '$.name'), '')
					)
				END AS target_name,
				NULLIF(json_extract(metadata, '$.previousName'), '') AS previous_name
			FROM pcd_ops
			WHERE origin = 'user' AND metadata IS NOT NULL AND json_valid(metadata)
		)
		WHERE entity IS NOT NULL AND target_name IS NOT NULL;

		-- json_extract throws on invalid JSON or non-object entries, which would
		-- abort the migration, so those are filtered out first.
		INSERT OR IGNORE INTO pcd_op_entities (op_id, database_id, entity, name, previous_name, role)
		SELECT op_id, database_id, entity, dep_name, NULL, 'prerequisite'
		FROM (
			SELECT
				o.id AS op_id,
				o.database_id AS database_id,
				CASE WHEN d.type = 'object' THEN COALESCE(
					NULLIF(json_extract(d.value, '$.entity'), ''),
					CASE json_extract(d.value, '$.key')
						WHEN 'custom_format_name' THEN 'custom_format'
						WHEN 'quality_profile_name' THEN 'quality_profile'
						WHEN 'regular_expression_name' THEN 'regular_expression'
					END
				) END AS entity,
				CASE WHEN d.type = 'object' THEN NULLIF(json_extract(d.value, '$.value'), '') END AS dep_name
			FROM pcd_ops o,
				json_each(
					CASE
						WHEN o.metadata IS NOT NULL AND json_valid(o.metadata)
							AND json_type(o.metadata, '$.depends_on') = 'array'
						THEN o.metadata
						ELSE '{"depends_on":[]}'
					END,
					'$.depends_on'
				) d
			WHERE o.origin = 'user'
		)
		WHERE entity IS NOT NULL AND dep_name IS NOT NULL;
	`,

	down: `
		DROP INDEX IF EXISTS idx_pcd_op_entities_lookup;
		DROP TABLE IF EXISTS pcd_op_entities;
	`
};
