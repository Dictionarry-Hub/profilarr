/**
 * Integration tests: untrusted markdown must not reach page HTML with a
 * live event handler.
 *
 * PCD authors control custom format and quality profile descriptions. Both
 * are rendered through the shared markdown renderer and end up in the
 * server-rendered HTML of the list pages. These tests seed a description
 * carrying an unquoted `onerror` attribute, the form the original regex
 * sanitizer let through, and fetch the pages over HTTP.
 *
 * SvelteKit also embeds the raw load data in a <script> block with `<`
 * escaped as <, so the raw markdown text legitimately appears there.
 * The assertion therefore looks for the rendered tag with a literal `<`.
 *
 * Tests:
 * 1. /custom-formats/[dbId] does not render an unquoted onerror handler
 * 2. /quality-profiles/[dbId] does not render an unquoted onerror handler
 */

import { startServer, stopServer } from '#integration/harness/server.ts';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { PORTS } from '#integration/harness/ports.ts';
import {
	setupPcd,
	seedBase,
	compilePcd,
	type PcdTestContext
} from '#integration/specs/pcd/harness/pcd.ts';
import { base } from '#integration/specs/pcd/harness/fixtures.ts';

const PORT = PORTS.auth.xss;
const ORIGIN = `http://localhost:${PORT}`;

const PAYLOAD = '<img src=x onerror=window.xssFired++>';
const RENDERED_HANDLER = '<img src=x onerror=window.xssFired++';
const CF_NAME = 'XSS Probe Format';
const QP_NAME = 'XSS Probe Profile';

let ctx: PcdTestContext;

async function fetchPage(path: string): Promise<{ status: number; body: string }> {
	const res = await ctx.client.get(path, { followRedirects: true });
	return { status: res.status, body: await res.text() };
}

function assertNotRendered(body: string, label: string) {
	expect(
		body.includes(RENDERED_HANDLER),
		`${label}: unquoted onerror handler was rendered into the page HTML`
	).toStrictEqual(false);
}

beforeAll(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	ctx = await setupPcd({ port: PORT, name: 'xss-probe' });
	seedBase(ctx, [
		base.customFormat({ name: CF_NAME, description: `Benign intro ${PAYLOAD} trailing text` }),
		base.qualityProfile({ name: QP_NAME, description: `Benign intro ${PAYLOAD} trailing text` })
	]);
	await compilePcd(ctx);
});

afterAll(async () => {
	await stopServer(PORT);
});

test('/custom-formats/[dbId] does not render an unquoted onerror handler', async () => {
	const { status, body } = await fetchPage(`/custom-formats/${ctx.dbId}`);
	expect(status).toStrictEqual(200);
	expect(body.includes(CF_NAME), 'seeded custom format is missing from the page').toStrictEqual(
		true
	);
	assertNotRendered(body, '/custom-formats');
});

test('/quality-profiles/[dbId] does not render an unquoted onerror handler', async () => {
	const { status, body } = await fetchPage(`/quality-profiles/${ctx.dbId}`);
	expect(status).toStrictEqual(200);
	expect(body.includes(QP_NAME), 'seeded quality profile is missing from the page').toStrictEqual(
		true
	);
	assertNotRendered(body, '/quality-profiles');
});
