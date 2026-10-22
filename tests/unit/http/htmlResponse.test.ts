/**
 * Tests for HTML answers to JSON requests. A reverse proxy login (Authelia,
 * Authentik) redirects the request to its portal page, and the error must say
 * so instead of failing to parse the page as JSON.
 */

import { assert, assertEquals, assertInstanceOf, assertRejects } from '@std/assert';
import { BaseArrClient } from '$arr/base.ts';
import { BaseHttpClient } from '$http/client.ts';
import { HtmlResponseError, HttpError } from '$http/types.ts';

const LOGIN_PAGE = '<!--\nSPDX-License-Identifier: Apache-2.0\n-->\n<!doctype html><html></html>';

const html = (body: string, status = 200) =>
	new Response(body, { status, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

/** Serves `handler` on a free local port for the length of `fn`. */
async function withServer(
	handler: (request: Request) => Response,
	fn: (origin: string) => Promise<void>
): Promise<void> {
	const server = Deno.serve({ port: 0, hostname: '127.0.0.1', onListen: () => {} }, handler);
	try {
		await fn(`http://127.0.0.1:${server.addr.port}`);
	} finally {
		await server.shutdown();
	}
}

async function withClient<T extends BaseHttpClient>(client: T, fn: (client: T) => Promise<void>) {
	await fn(client);
}

Deno.test('HTML responses to JSON requests', async (t) => {
	await t.step('a redirect to a login page names the host that answered', async () => {
		await withServer(
			() => html(LOGIN_PAGE),
			(portal) =>
				withServer(
					() => Response.redirect(`${portal}/?rd=status`, 302),
					(arr) =>
						withClient(new BaseHttpClient(arr, { retries: 0 }), async (client) => {
							const error = await assertRejects(
								() => client.get('/api/v3/system/status'),
								HtmlResponseError
							);
							const host = new URL(portal).host;
							assertEquals(
								error.message,
								`Expected JSON but got a web page from ${host} after a redirect. A reverse proxy may be asking for a login.`
							);
							assertEquals(error.status, 200);
						})
				)
		);
	});

	await t.step('an HTML page without a redirect is still reported as a web page', async () => {
		await withServer(
			() => html(LOGIN_PAGE),
			(origin) =>
				withClient(new BaseHttpClient(origin, { retries: 0 }), async (client) => {
					const error = await assertRejects(() => client.get('/api'), HtmlResponseError);
					assert(!error.message.includes('after a redirect'));
				})
		);
	});

	await t.step('an HTML error page reports the status, not a web page', async () => {
		await withServer(
			() => html('<html>Not Found</html>', 404),
			(origin) =>
				withClient(new BaseHttpClient(origin, { retries: 0 }), async (client) => {
					const error = await assertRejects(() => client.get('/missing'), HttpError);
					assert(!(error instanceof HtmlResponseError));
					assertEquals(error.status, 404);
					assertEquals(error.message, 'HTTP 404: Not Found');
				})
		);
	});

	await t.step('a JSON response is parsed as before', async () => {
		await withServer(
			() => Response.json({ ok: true }),
			(origin) =>
				withClient(new BaseHttpClient(origin, { retries: 0 }), async (client) => {
					assertEquals(await client.get('/status'), { ok: true });
				})
		);
	});

	await t.step('detectVersion behind a proxy login rejects with the web page error', async () => {
		await withServer(
			() => html(LOGIN_PAGE),
			(origin) =>
				withClient(new BaseArrClient(origin, 'test-api-key', { retries: 0 }), async (client) => {
					const error = await assertRejects(() => client.detectVersion());
					assertInstanceOf(error, HtmlResponseError);
				})
		);
	});
});
