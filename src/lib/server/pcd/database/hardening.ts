/**
 * PCD connection hardening - block ATTACH on connections that run op SQL
 *
 * Linked databases run their ops as raw SQL. SQLite's ATTACH, and VACUUM INTO,
 * which attaches internally, would let that SQL open Profilarr's own database
 * or write new files. @db/sqlite doesn't bind sqlite3_limit, so this module
 * binds it from the same SQLite library and sets the attached-database limit
 * to 0 on each connection.
 */

import { type Database, SQLITE_SOURCEID } from '@db/sqlite';

const SQLITE_LIMIT_ATTACHED = 7;
const SQLITE_MAX_ATTACHED = 125;

// Must match the @db/sqlite version in deno.jsonc. In dev the library path is
// derived from it. A mismatch fails closed: the path or source ID check fails.
const DB_SQLITE_VERSION = '0.12.0';

const symbols = {
	sqlite3_limit: { parameters: ['pointer', 'i32', 'i32'], result: 'i32' },
	sqlite3_sourceid: { parameters: [], result: 'pointer' }
} as const;

type SqliteLimitLibrary = Deno.DynamicLibrary<typeof symbols>;

let library: Promise<SqliteLimitLibrary> | null = null;

/**
 * Block ATTACH on a connection that will run PCD op SQL.
 *
 * Call right after `new Database(...)`, before any op SQL runs. Throws if the
 * limit can't be set and verified, so callers fail closed.
 */
export async function hardenConnection(db: Database): Promise<void> {
	const { sqlite3_limit } = (await openSameLibrary()).symbols;

	// A negative new value only reads the current limit
	const current = sqlite3_limit(db.unsafeHandle, SQLITE_LIMIT_ATTACHED, -1);
	if (current < 0 || current > SQLITE_MAX_ATTACHED) {
		throw new Error(`SQLite hardening: unexpected attach limit ${current}`);
	}
	sqlite3_limit(db.unsafeHandle, SQLITE_LIMIT_ATTACHED, 0);

	try {
		db.exec("ATTACH ':memory:' AS hardening_probe");
	} catch (error) {
		if (String(error).includes('too many attached databases')) return;
		throw error;
	}
	db.exec('DETACH hardening_probe');
	throw new Error('SQLite hardening: ATTACH is still allowed');
}

function openSameLibrary(): Promise<SqliteLimitLibrary> {
	library ??= loadSameLibrary().catch((error) => {
		library = null;
		throw error;
	});
	return library;
}

/**
 * Open the SQLite library @db/sqlite already loaded. A connection handle from
 * one copy of SQLite must not be passed to another, so the path mirrors
 * @db/sqlite's own lookup and the source ID must match the loaded library's.
 */
async function loadSameLibrary(): Promise<SqliteLimitLibrary> {
	const path = await resolveLibraryPath();
	const candidate = Deno.dlopen(path, symbols);
	const pointer = candidate.symbols.sqlite3_sourceid();
	const sourceId = pointer ? new Deno.UnsafePointerView(pointer).getCString() : '';

	if (sourceId !== SQLITE_SOURCEID) {
		candidate.close();
		throw new Error(`SQLite hardening: ${path} is not the library @db/sqlite loaded`);
	}
	return candidate;
}

/**
 * Mirror how @db/sqlite finds its library: DENO_SQLITE_PATH (set in Docker),
 * otherwise the file @denosaurs/plug downloaded into the Deno cache.
 */
async function resolveLibraryPath(): Promise<string> {
	if (Deno.env.get('DENO_SQLITE_LOCAL') === '1') {
		throw new Error('SQLite hardening: DENO_SQLITE_LOCAL is not supported');
	}

	const customPath = Deno.env.get('DENO_SQLITE_PATH');
	if (customPath) return customPath;

	if (Deno.build.os !== 'linux' && Deno.build.os !== 'darwin') {
		throw new Error(`SQLite hardening: unsupported OS ${Deno.build.os}`);
	}

	const extension = Deno.build.os === 'darwin' ? 'dylib' : 'so';
	const suffix = Deno.build.arch === 'aarch64' ? '_aarch64' : '';
	const pathname = `/denodrivers/sqlite3/releases/download/${DB_SQLITE_VERSION}/libsqlite3${suffix}.${extension}`;
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pathname));
	const hash = Array.from(new Uint8Array(digest), (byte) =>
		byte.toString(16).padStart(2, '0')
	).join('');

	return `${denoCacheDir()}/plug/https/github.com/${hash}.${extension}`;
}

function denoCacheDir(): string {
	const denoDir = Deno.env.get('DENO_DIR');
	if (denoDir) return denoDir.startsWith('/') ? denoDir : `${Deno.cwd()}/${denoDir}`;

	const home = Deno.env.get('HOME');
	if (Deno.build.os === 'darwin') return `${home}/Library/Caches/deno`;
	return `${Deno.env.get('XDG_CACHE_HOME') ?? `${home}/.cache`}/deno`;
}
