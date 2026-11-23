/**
 * Integration tests for deleting an Arr instance through the web UI forms.
 *
 * Three pages post a `delete` action: the settings page, the list page and the
 * library page. All of them go through the same service, so each must remove
 * the instance and its scheduled jobs and leave other instances alone. An unknown
 * instance is a 404 on the settings and list pages, and a redirect on the library page.
 */

import { afterAll, beforeAll, beforeEach, expect, test } from 'vitest';
import { TestClient } from '#integration/harness/client.ts';
import { openDb } from '#integration/harness/db.ts';
import { PORTS } from '#integration/harness/ports.ts';
import { getDbPath, startServer, stopServer } from '#integration/harness/server.ts';
import { formResult } from '#integration/harness/setup.ts';

const PORT = PORTS.arr.delete;
const ORIGIN = `http://localhost:${PORT}`;

let client: TestClient;

/** Posts a form action and returns the status and redirect target the action answered with. */
async function postDelete(path: string, fields: Record<string, string> = {}) {
	const res = await client.postForm(path, fields, { headers: { Origin: ORIGIN } });
	return await formResult(res);
}

function withDb<T>(run: (db: ReturnType<typeof openDb>) => T): T {
	const db = openDb(getDbPath(PORT));
	try {
		return run(db);
	} finally {
		db.close();
	}
}

/** Inserts an instance with a scheduled cleanup job and returns its id. */
function seedInstance(name: string, port: number): number {
	return withDb((db) => {
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES (?, 'radarr', ?, 'secret-key', 1)`,
			[name, `http://127.0.0.1:${port}`]
		);
		const { id } = db.prepare('SELECT last_insert_rowid() AS id').get() as { id: number };
		db.exec(
			`INSERT INTO job_queue (job_type, status, run_at, payload)
			 VALUES ('arr.cleanup', 'queued', '2099-01-01T00:00:00.000Z', ?)`,
			[JSON.stringify({ instanceId: id })]
		);
		return id;
	});
}

function instanceExists(id: number): boolean {
	return withDb(
		(db) => db.prepare('SELECT 1 FROM arr_instances WHERE id = ?').get(id) !== undefined
	);
}

function jobsFor(id: number): number {
	return withDb((db) => {
		const rows = db
			.prepare(`SELECT payload FROM job_queue WHERE job_type = 'arr.cleanup'`)
			.all() as { payload: string }[];
		return rows.filter((row) => JSON.parse(row.payload).instanceId === id).length;
	});
}

let target: number;
let bystander: number;

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	client = new TestClient(ORIGIN);
});

afterAll(async () => {
	await stopServer(PORT);
});

beforeEach(() => {
	withDb((db) => {
		db.exec('DELETE FROM job_queue');
		db.exec('DELETE FROM arr_instances');
	});
	target = seedInstance('Target', 17001);
	bystander = seedInstance('Bystander', 17002);
});

function expectDeletedAndBystanderKept(): void {
	expect(instanceExists(target)).toStrictEqual(false);
	expect(jobsFor(target)).toStrictEqual(0);

	expect(instanceExists(bystander)).toStrictEqual(true);
	expect(jobsFor(bystander)).toStrictEqual(1);
}

test('the settings page deletes the instance and its jobs', async () => {
	const res = await postDelete(`/arr/${target}/settings?/delete`);

	expect(res.status).toStrictEqual(303);
	expect(res.location).toStrictEqual('/arr');
	expectDeletedAndBystanderKept();
});

test('the list page deletes the instance and its jobs', async () => {
	const res = await postDelete('/arr?/delete', { id: String(target) });

	expect(res.status).toStrictEqual(303);
	expect(res.location).toStrictEqual('/arr');
	expectDeletedAndBystanderKept();
});

test('the library page deletes the instance and its jobs', async () => {
	const res = await postDelete(`/arr/${target}/library?/delete`);

	expect(res.status).toStrictEqual(303);
	expect(res.location).toStrictEqual('/arr');
	expectDeletedAndBystanderKept();
});

test('the settings and list pages refuse an instance that does not exist', async () => {
	const responses = await Promise.all([
		postDelete('/arr/99999/settings?/delete'),
		postDelete('/arr?/delete', { id: '99999' })
	]);

	expect(responses.map((res) => res.status)).toStrictEqual([404, 404]);
	expect(instanceExists(target)).toStrictEqual(true);
	expect(instanceExists(bystander)).toStrictEqual(true);
});

test('the library page returns to the list for an instance that does not exist', async () => {
	const res = await postDelete('/arr/99999/library?/delete');

	expect(res.status).toStrictEqual(303);
	expect(res.location).toStrictEqual('/arr');
	expect(instanceExists(target)).toStrictEqual(true);
	expect(instanceExists(bystander)).toStrictEqual(true);
});

test('the list page refuses a request without an instance id', async () => {
	const res = await postDelete('/arr?/delete');

	expect(res.status).toStrictEqual(400);
	expect(instanceExists(target)).toStrictEqual(true);
});
