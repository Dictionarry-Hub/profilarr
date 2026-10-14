/**
 * Integration tests: untrusted markdown must not reach page HTML with a
 * live event handler.
 *
 * PCD authors control custom format and quality profile descriptions. Both
 * are rendered through sanitizeHtml() and end up in the server-rendered
 * HTML of the list pages. These tests seed a description carrying an
 * unquoted `onerror` attribute (which the sanitizer's quoted-only regexes
 * miss) and fetch the pages over HTTP.
 *
 * SvelteKit also embeds the raw load data in a <script> block with `<`
 * escaped as <, so the raw markdown text legitimately appears there.
 * The assertion therefore looks for the rendered tag with a literal `<`.
 *
 * Tests:
 * 1. /custom-formats/[dbId] does not render an unquoted onerror handler
 * 2. /quality-profiles/[dbId] does not render an unquoted onerror handler
 */

import { assertEquals } from '@std/assert';
import { startServer, stopServer } from '$test-harness/server.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { setupPcd, seedBase, compilePcd, type PcdTestContext } from '../../pcd/harness/pcd.ts';
import { base } from '../../pcd/harness/fixtures.ts';

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
	assertEquals(
		body.includes(RENDERED_HANDLER),
		false,
		`${label}: unquoted onerror handler was rendered into the page HTML`
	);
}

setup(async () => {
	await startServer(PORT, { AUTH: 'off', ORIGIN }, 'preview');
	ctx = await setupPcd({ port: PORT, name: 'xss-probe' });
	seedBase(ctx, [
		base.customFormat({ name: CF_NAME, description: `Benign intro ${PAYLOAD} trailing text` }),
		base.qualityProfile({ name: QP_NAME, description: `Benign intro ${PAYLOAD} trailing text` })
	]);
	await compilePcd(ctx);
});

teardown(async () => {
	await stopServer(PORT);
});

test('/custom-formats/[dbId] does not render an unquoted onerror handler', async () => {
	const { status, body } = await fetchPage(`/custom-formats/${ctx.dbId}`);
	assertEquals(status, 200);
	assertEquals(body.includes(CF_NAME), true, 'seeded custom format is missing from the page');
	assertNotRendered(body, '/custom-formats');
});

test('/quality-profiles/[dbId] does not render an unquoted onerror handler', async () => {
	const { status, body } = await fetchPage(`/quality-profiles/${ctx.dbId}`);
	assertEquals(status, 200);
	assertEquals(body.includes(QP_NAME), true, 'seeded quality profile is missing from the page');
	assertNotRendered(body, '/quality-profiles');
});

await run();
