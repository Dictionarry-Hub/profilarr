/**
 * Kysely dialect for the `node:sqlite` driver in `./sqlite.ts`.
 *
 * Kysely's built-in SqliteDialect expects a better-sqlite3 style database.
 * This adapts a `node:sqlite` connection to that shape, reusing the driver's
 * value conversion. The owner of the Database closes it; destroying
 * the Kysely instance leaves the connection open.
 */

import { SqliteDialect } from 'kysely';
import type { SqliteDatabase, SqliteStatement } from 'kysely';
import { toSqlValues, type Database } from './sqlite.ts';

export function createSqliteDialect(database: Database): SqliteDialect {
	const raw = database.raw;
	const adapter: SqliteDatabase = {
		close() {
			// owned by the caller
		},
		prepare(sql: string): SqliteStatement {
			const stmt = raw.prepare(sql);
			return {
				// node:sqlite has no `reader` flag; a statement returns rows if it has result columns
				reader: stmt.columns().length > 0,
				all: (params) => stmt.all(...toSqlValues(params)),
				run: (params) => stmt.run(...toSqlValues(params)),
				iterate: (params) => stmt.iterate(...toSqlValues(params))
			};
		}
	};
	return new SqliteDialect({ database: adapter });
}
