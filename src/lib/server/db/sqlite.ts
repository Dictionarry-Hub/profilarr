/**
 * SQLite driver on top of `node:sqlite`.
 *
 * `node:sqlite` ships with Deno, Node and Bun with the same API, so no native
 * library or FFI is needed. This module keeps the subset of the old
 * `@db/sqlite` surface the app uses, so call sites stay unchanged:
 *
 * - Statements take positional parameters, one array of them, or one object
 *   of named ones.
 * - Booleans bind as 1/0, Dates as ISO strings and other plain objects as
 *   JSON, matching `@db/sqlite`'s binding rules (`node:sqlite` rejects them).
 * - `exec(sql, ...params)` binds parameters when given, like `@db/sqlite`.
 * - `changes` and `totalChanges` read SQLite's own counters, so they also
 *   reflect `exec()` calls.
 *
 * Integers are returned as numbers. Values outside the safe integer range
 * throw instead of turning into a BigInt.
 */

import { DatabaseSync, backup as sqliteBackup } from 'node:sqlite';
import type { DatabaseSyncOptions, StatementSync, SQLInputValue } from 'node:sqlite';

export type BindValue =
	| string
	| number
	| bigint
	| boolean
	| null
	| undefined
	| Uint8Array
	| Date
	| Record<string, unknown>
	| unknown[];

export type RestBindParameters = BindValue[];

export interface DatabaseOpenOptions {
	readonly?: boolean;
	/** SQLite run-time limits. `attach: 0` blocks ATTACH and VACUUM INTO. */
	limits?: { attach?: number };
}

// `limits` exists at runtime but is missing from the bundled Node type definitions
type SyncOptionsWithLimits = DatabaseSyncOptions & { limits?: { attach?: number } };

function toSqlValue(value: unknown): SQLInputValue {
	if (value === null || value === undefined) return null;
	switch (typeof value) {
		case 'string':
		case 'number':
		case 'bigint':
			return value;
		case 'boolean':
			return value ? 1 : 0;
		case 'object':
			if (value instanceof Uint8Array) return value;
			if (value instanceof Date) return value.toISOString();
			return JSON.stringify(value);
		default:
			throw new TypeError(`Value of unsupported type: ${typeof value}`);
	}
}

/** Convert a list of values to the form `node:sqlite` binds */
export function toSqlValues(values: readonly unknown[]): SQLInputValue[] {
	return values.map(toSqlValue);
}

/**
 * Statement parameters in the form `node:sqlite` accepts. Like `@db/sqlite`,
 * an array or plain object in the first position replaces the rest: an array
 * is the positional list, an object holds named parameters.
 */
export function normalizeParams(params: readonly unknown[]): SQLInputValue[] {
	const first = params[0];
	if (
		typeof first !== 'object' ||
		first === null ||
		first instanceof Uint8Array ||
		first instanceof Date
	) {
		return toSqlValues(params);
	}
	if (Array.isArray(first)) return toSqlValues(first);

	const named: Record<string, SQLInputValue> = {};
	for (const [key, value] of Object.entries(first)) {
		named[key] = toSqlValue(value);
	}
	// node:sqlite takes named parameters as one object in the first position
	return [named as unknown as SQLInputValue];
}

export class Statement {
	readonly #stmt: StatementSync;

	constructor(stmt: StatementSync) {
		this.#stmt = stmt;
	}

	get<T = Record<string, unknown>>(...params: RestBindParameters): T | undefined {
		return this.#stmt.get(...normalizeParams(params)) as T | undefined;
	}

	all<T = Record<string, unknown>>(...params: RestBindParameters): T[] {
		return this.#stmt.all(...normalizeParams(params)) as T[];
	}

	/** Run the statement and return the number of changed rows */
	run(...params: RestBindParameters): number {
		return Number(this.#stmt.run(...normalizeParams(params)).changes);
	}

	/** No-op: `node:sqlite` finalizes statements when they are garbage collected */
	finalize(): void {}
}

type CounterName = 'changes' | 'total';

export class Database {
	readonly #db: DatabaseSync;
	#counters: Partial<Record<CounterName, StatementSync>> = {};

	constructor(path: string, options: DatabaseOpenOptions = {}) {
		const syncOptions: SyncOptionsWithLimits = { readOnly: options.readonly ?? false };
		if (options.limits) syncOptions.limits = options.limits;
		this.#db = new DatabaseSync(path, syncOptions);
	}

	/** Underlying `node:sqlite` database, used by the Kysely dialect */
	get raw(): DatabaseSync {
		return this.#db;
	}

	/**
	 * Run SQL. Without parameters it may hold several statements; with
	 * parameters it must be one statement and returns the changed row count.
	 */
	exec(sql: string, ...params: RestBindParameters): number {
		if (params.length > 0) return this.prepare(sql).run(...params);
		this.#db.exec(sql); // nosemgrep: profilarr.sql.exec-with-variable — thin driver wrapper
		return this.changes;
	}

	prepare(sql: string): Statement {
		return new Statement(this.#db.prepare(sql));
	}

	#counter(name: CounterName): number {
		let stmt = this.#counters[name];
		if (!stmt) {
			stmt = this.#db.prepare(
				name === 'changes' ? 'SELECT changes() AS n' : 'SELECT total_changes() AS n'
			);
			this.#counters[name] = stmt;
		}
		return Number((stmt.get() as { n: number | bigint }).n);
	}

	/** Rows changed by the most recent INSERT, UPDATE or DELETE */
	get changes(): number {
		return this.#counter('changes');
	}

	/** Rows changed since the connection was opened */
	get totalChanges(): number {
		return this.#counter('total');
	}

	/** Register a scalar SQL function */
	function(
		name: string,
		fn: (...args: never[]) => unknown,
		options: { deterministic?: boolean } = {}
	): void {
		this.#db.function(
			name,
			{ deterministic: options.deterministic ?? false },
			fn as (...args: SQLInputValue[]) => SQLInputValue
		);
	}

	/** Online copy of this database to a new file */
	async backupTo(destPath: string): Promise<void> {
		await sqliteBackup(this.#db, destPath);
	}

	close(): void {
		this.#counters = {};
		if (this.#db.isOpen) this.#db.close();
	}
}

/**
 * Open an in-memory database that can't reach other database files.
 *
 * PCD op SQL comes from linked repos and runs as written. SQLite's ATTACH, and
 * VACUUM INTO, which attaches internally, would let it open Profilarr's own
 * database or write new files. An attach limit of 0 blocks both. A probe
 * ATTACH must fail before the connection is returned, so a runtime that
 * ignores the limit fails closed.
 */
export function openIsolatedDatabase(): Database {
	const database = new Database(':memory:', { limits: { attach: 0 } });
	try {
		database.exec("ATTACH ':memory:' AS isolation_probe");
	} catch (error) {
		if (String(error).includes('too many attached databases')) return database;
		database.close();
		throw error;
	}
	database.close();
	throw new Error('SQLite isolation: ATTACH is still allowed');
}
