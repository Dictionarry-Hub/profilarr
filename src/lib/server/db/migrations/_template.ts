import type { Migration } from '#db/migrations.ts';

/**
 * MIGRATION TEMPLATE
 *
 * Copy this file to create a new migration:
 * 1. Copy _template.ts to a new file (e.g., 001_initial_schema.ts)
 * 2. Update the version number (must be unique and sequential)
 * 3. Update the name (describe what this migration does)
 * 4. Write your SQL in the `up` section
 * 5. Write rollback SQL in the `down` section (optional but recommended)
 * 6. Delete these comments
 *
 * NAMING CONVENTION:
 * - Use format: NNN_description.ts (e.g., 001_initial_schema.ts, 002_add_users.ts)
 * - Numbers should be sequential (001, 002, 003, ...)
 * - Use underscores for spaces in description
 * - Keep descriptions short but descriptive
 *
 * BEST PRACTICES:
 * - Always test migrations in development first
 * - Keep migrations small and focused
 * - Use transactions (handled automatically)
 * - Always provide a `down` migration for rollback capability
 * - Use IF NOT EXISTS for tables/indexes when appropriate
 * - Comment complex SQL
 *
 * VERSION NUMBERS:
 * - Must be unique integers
 * - Should be sequential (1, 2, 3, ...)
 * - Once applied to production, NEVER change a migration
 * - If you need to fix a migration, create a new one
 */

export const migration: Migration = {
	// REQUIRED: Unique version number (increment from last migration)
	version: 999, // CHANGE THIS

	// REQUIRED: Human-readable description
	name: 'Template migration - CHANGE THIS',

	// REQUIRED: SQL to apply the migration (forward migration)
	up: `
		-- Example: Create a new table
		CREATE TABLE IF NOT EXISTS example_table (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			name TEXT NOT NULL,
			email TEXT UNIQUE,
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Example: Create an index
		CREATE INDEX IF NOT EXISTS idx_example_email ON example_table(email);

		-- Example: Insert initial data
		INSERT INTO example_table (name, email) VALUES ('Example', 'example@example.com');
	`,

	// OPTIONAL: SQL to rollback the migration (reverse migration)
	// If not provided, migration cannot be rolled back
	down: `
		-- Rollback in reverse order of 'up'
		DROP INDEX IF EXISTS idx_example_email;
		DROP TABLE IF EXISTS example_table;
	`
};

// Alternative: You can also use default export
// export default migration;
