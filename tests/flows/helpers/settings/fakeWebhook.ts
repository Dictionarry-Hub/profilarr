/**
 * A fake webhook receiver for notification services. It listens on
 * 127.0.0.1, records every request it gets, and answers 200 unless a path is
 * set to fail. Each test starts its own through the `fakeWebhook` fixture,
 * which stops it after the test.
 *
 * Paths can hold secrets, like a real webhook URL, so a scenario can check
 * that the URL never reaches the page.
 */

import { createServer, type IncomingHttpHeaders, type IncomingMessage } from 'node:http';
import { freePort } from '$flows/harness/ports.ts';

/** One request the receiver got */
export interface WebhookRequest {
	method: string;
	/** The path, without the query */
	path: string;
	headers: IncomingHttpHeaders;
	/** The body, parsed as JSON when it is JSON, else the text, else null */
	body: unknown;
}

export interface FakeWebhook {
	/** The full URL of a path on this receiver, e.g. `url('/hooks/abc')` */
	url(path: string): string;
	/** Every request, oldest first */
	requests: WebhookRequest[];
	/** Answer every request to `path` with `status` from now on */
	failWith(path: string, status: number): void;
	stop(): Promise<void>;
}

function readBody(req: IncomingMessage): Promise<unknown> {
	return new Promise((resolveBody) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			const text = Buffer.concat(chunks).toString('utf8');
			if (!text) return resolveBody(null);
			try {
				resolveBody(JSON.parse(text));
			} catch {
				resolveBody(text);
			}
		});
	});
}

export async function startFakeWebhook(): Promise<FakeWebhook> {
	const requests: WebhookRequest[] = [];
	const failures = new Map<string, number>();

	const server = createServer(async (req, res) => {
		const path = new URL(req.url ?? '/', 'http://127.0.0.1').pathname;
		const body = await readBody(req);
		requests.push({ method: req.method ?? 'GET', path, headers: req.headers, body });
		res.statusCode = failures.get(path) ?? 200;
		res.end();
	});

	const port = await freePort();
	await new Promise<void>((resolveListen, reject) => {
		server.once('error', reject);
		server.listen(port, '127.0.0.1', () => resolveListen());
	});
	const base = `http://127.0.0.1:${port}`;

	return {
		url: (path) => `${base}${path.startsWith('/') ? path : `/${path}`}`,
		requests,
		failWith: (path, status) => {
			failures.set(path, status);
		},
		stop: () =>
			new Promise<void>((resolveStop) => {
				server.closeAllConnections();
				server.close(() => resolveStop());
			})
	};
}
