/**
 * PCD security tests: ops must not reach other database files.
 *
 * Every op from a linked database runs on the PCD cache connection. These
 * specs seed ops that try to open Profilarr's own database, or create new
 * files, and assert that nothing outside the cache is read, changed, or
 * written.
 */

import { mkdir, realpath, stat, writeFile } from 'node:fs/promises';
import { startServer, stopServer } from '#integration/harness/server.ts';
import { openDb } from '#integration/harness/db.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import {
	compilePcd,
	insertOp,
	seedBase,
	setupPcd,
	type PcdTestContext
} from '#integration/specs/pcd/harness/pcd.ts';

const PORT = PORTS.pcd.securityAttach;
const ORIGIN = `http://localhost:${PORT}`;

interface Scenario {
	ctx: PcdTestContext;
	/** Absolute path to the server's app database. */
	appDb: string;
	/** Absolute path to the server's base directory, used as a target for new files. */
	baseDir: string;
	/** Table an op would create in the app database if ATTACH worked. */
	marker: string;
}

interface AttachForm {
	name: string;
	sql: (s: Scenario) => string;
}

let counter = 0;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
});

afterAll(async () => {
	await stopServer(PORT);
});

const ATTACH_FORMS: AttachForm[] = [
	{
		name: 'plain ATTACH',
		sql: (s) => plainAttach(s)
	},
	{
		name: 'ATTACH DATABASE',
		sql: (s) => `ATTACH DATABASE ${sqlString(s.appDb)} AS app;\n${createMarker(s)}`
	},
	{
		name: 'mixed case with comments',
		sql: (s) =>
			`aTtAcH /* hidden */ DaTaBaSe ${sqlString(s.appDb)} -- trailing\nAS app;\n${createMarker(s)}`
	},
	{
		name: 'path built from pieces',
		sql: (s) => {
			const dir = s.appDb.slice(0, s.appDb.lastIndexOf('/'));
			return `ATTACH ${sqlString(dir)} || '/' || 'profilarr.db' AS app;\n${createMarker(s)}`;
		}
	},
	{
		name: 'URI path',
		sql: (s) => `ATTACH ${sqlString(`file:${s.appDb}`)} AS app;\n${createMarker(s)}`
	},
	{
		name: 'ATTACH in the middle of an op',
		sql: (s) =>
			[
				`INSERT INTO tags (name) VALUES ('before attach');`,
				`ATTACH ${sqlString(s.appDb)} AS app;`,
				createMarker(s),
				`INSERT INTO tags (name) VALUES ('after attach');`
			].join('\n')
	}
];

/**
 * Context
 *   Empty PCD (only schema seeded).
 *
 * Op (base layer)
 *   INSERT INTO tags (name) VALUES ('control tag');
 *
 * Expect
 *   - latest op history status === 'applied'
 *
 * Control: proves ordinary ops still compile on a hardened connection, so the
 * other specs can't pass just because nothing ran.
 */
test('ordinary base op still applies', async () => {
	const s = await scenario('control');
	const [opId] = seedBase(s.ctx, [`INSERT INTO tags (name) VALUES ('control tag');`]);
	await compilePcd(s.ctx);

	expect(latestOpHistory(s, opId)?.status).toStrictEqual('applied');
});

/**
 * Context
 *   Empty PCD (only schema seeded).
 *
 * Op (base layer)
 *   Attaches the app database with the given form, then creates a marker
 *   table in it.
 *
 * Expect
 *   - the op is recorded as an error from the attach limit
 *   - the marker table does not exist in the app database
 */
for (const form of ATTACH_FORMS) {
	test(`base op: ${form.name} cannot write to the app database`, async () => {
		const s = await scenario('form');
		const [opId] = seedBase(s.ctx, [form.sql(s)]);
		await compilePcd(s.ctx);

		assertBlockedByAttachLimit(s, opId);
		expect(
			appTableExists(s, s.marker),
			`${form.name} created ${s.marker} in the app database`
		).toStrictEqual(false);
	});
}

/**
 * Context
 *   Empty PCD. The database instance has a random UUID.
 *
 * Op (base layer)
 *   Attaches the app database and copies this instance's UUID into a regex
 *   description: 'leaked-<uuid>'.
 *
 * Expect
 *   - the op is recorded as an error from the attach limit
 *   - the regex list page does not contain 'leaked-<uuid>'
 */
test('base op cannot copy app database values into the cache', async () => {
	const uuid = crypto.randomUUID();
	const s = await scenario('read', uuid);
	const [opId] = seedBase(s.ctx, [
		[
			`ATTACH ${sqlString(s.appDb)} AS app;`,
			`INSERT INTO regular_expressions (name, pattern, description)`,
			`SELECT 'Leak Probe', 'leak', 'leaked-' || uuid`,
			`FROM app.database_instances WHERE id = ${s.ctx.dbId};`
		].join('\n')
	]);
	await compilePcd(s.ctx);

	assertBlockedByAttachLimit(s, opId);
	const response = await s.ctx.client.get(`/regular-expressions/${s.ctx.dbId}`);
	const body = await response.text();
	expect(
		!body.includes(`leaked-${uuid}`),
		'The regex list page shows a value copied from the app database'
	).toBeTruthy();
});

/**
 * Context
 *   Empty PCD.
 *
 * Op (base layer)
 *   Attaches a file that does not exist yet and creates a table in it.
 *
 * Expect
 *   - the op is recorded as an error from the attach limit
 *   - the file does not exist on disk
 */
test('base op cannot create a new database file with ATTACH', async () => {
	const s = await scenario('new-file');
	const target = `${s.baseDir}/attach-created-${counter}.db`;
	const [opId] = seedBase(s.ctx, [
		`ATTACH ${sqlString(target)} AS created;\nCREATE TABLE created.probe (x INTEGER);`
	]);
	await compilePcd(s.ctx);

	assertBlockedByAttachLimit(s, opId);
	expect(await fileExists(target), `ATTACH created ${target}`).toStrictEqual(false);
});

/**
 * Context
 *   Empty PCD.
 *
 * Op (base layer)
 *   VACUUM INTO a new file, which writes a copy of the cache to disk.
 *
 * Expect
 *   - the op is recorded as an error from the attach limit
 *   - the file does not exist on disk
 */
test('base op cannot write a copy of the cache with VACUUM INTO', async () => {
	const s = await scenario('vacuum');
	const target = `${s.baseDir}/vacuum-into-${counter}.db`;
	const [opId] = seedBase(s.ctx, [`VACUUM INTO ${sqlString(target)};`]);
	await compilePcd(s.ctx);

	assertBlockedByAttachLimit(s, opId);
	expect(await fileExists(target), `VACUUM INTO wrote ${target}`).toStrictEqual(false);
});

/**
 * Context
 *   Empty PCD.
 *
 * Op (base layer)
 *   ATTACH ':memory:' AS mem;
 *   ATTACH '' AS tmp;
 *
 * Expect
 *   - the op is recorded as an error from the attach limit
 */
test('base op cannot attach in-memory or temporary databases', async () => {
	const s = await scenario('any');
	const [opId] = seedBase(s.ctx, [`ATTACH ':memory:' AS mem;\nATTACH '' AS tmp;`]);
	await compilePcd(s.ctx);

	assertBlockedByAttachLimit(s, opId);
});

/**
 * Context
 *   Empty PCD plus a second schema file, deps/schema/ops/1.attach.sql.
 *
 * Op (schema layer)
 *   Plain ATTACH of the app database, then a marker table.
 *
 * Expect
 *   - the marker table does not exist in the app database
 */
test('schema file cannot write to the app database', async () => {
	const s = await scenario('schema');
	await writeFile(`${s.ctx.pcdPath}/deps/schema/ops/1.attach.sql`, plainAttach(s));
	await compilePcd(s.ctx);

	expect(appTableExists(s, s.marker), `schema file created ${s.marker}`).toStrictEqual(false);
});

/**
 * Context
 *   Empty PCD plus a tweak file, tweaks/1.attach.sql.
 *
 * Op (tweaks layer)
 *   Plain ATTACH of the app database, then a marker table.
 *
 * Expect
 *   - the marker table does not exist in the app database
 */
test('tweak file cannot write to the app database', async () => {
	const s = await scenario('tweak');
	await mkdir(`${s.ctx.pcdPath}/tweaks`, { recursive: true });
	await writeFile(`${s.ctx.pcdPath}/tweaks/1.attach.sql`, plainAttach(s));
	await compilePcd(s.ctx);

	expect(appTableExists(s, s.marker), `tweak file created ${s.marker}`).toStrictEqual(false);
});

/**
 * Context
 *   Empty PCD.
 *
 * Op (user layer)
 *   Plain ATTACH of the app database, then a marker table.
 *
 * Expect
 *   - the op is recorded as an error from the attach limit
 *   - the marker table does not exist in the app database
 */
test('user op cannot write to the app database', async () => {
	const s = await scenario('user');
	const opId = insertOp(s.ctx, { origin: 'user', sql: plainAttach(s) });
	await compilePcd(s.ctx);

	assertBlockedByAttachLimit(s, opId);
	expect(appTableExists(s, s.marker), `user op created ${s.marker}`).toStrictEqual(false);
});

async function scenario(label: string, uuid?: string): Promise<Scenario> {
	counter += 1;
	const ctx = await setupPcd({ port: PORT, name: `attach-${label}-${counter}`, uuid });
	return {
		ctx,
		appDb: await realpath(ctx.dbPath),
		baseDir: await realpath(ctx.basePath),
		marker: `attach_marker_${counter}`
	};
}

function plainAttach(s: Scenario): string {
	return `ATTACH ${sqlString(s.appDb)} AS app;\n${createMarker(s)}`;
}

function createMarker(s: Scenario): string {
	return `CREATE TABLE app.${s.marker} (x INTEGER);`;
}

function sqlString(value: string): string {
	return `'${value.replaceAll("'", "''")}'`;
}

function appTableExists(s: Scenario, table: string): boolean {
	const db = openDb(s.ctx.dbPath);
	try {
		const row = db
			.prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
			.get(table);
		return row !== undefined;
	} finally {
		db.close();
	}
}

async function fileExists(path: string): Promise<boolean> {
	try {
		await stat(path);
		return true;
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false;
		throw error;
	}
}

/** Proves the op ran and SQLite refused the attach, rather than the op never running. */
function assertBlockedByAttachLimit(s: Scenario, opId: number): void {
	const history = latestOpHistory(s, opId);
	expect(history?.status, `Expected op ${opId} to be recorded as an error`).toStrictEqual('error');
	expect(
		history?.error?.includes('too many attached databases'),
		`Expected the attach limit error, got ${history?.error ?? 'no error'}`
	).toBeTruthy();
}

function latestOpHistory(
	s: Scenario,
	opId: number
): { status: string; error: string | null } | undefined {
	const db = openDb(s.ctx.dbPath);
	try {
		return db
			.prepare('SELECT status, error FROM pcd_op_history WHERE op_id = ? ORDER BY id DESC LIMIT 1')
			.get(opId) as { status: string; error: string | null } | undefined;
	} finally {
		db.close();
	}
}
