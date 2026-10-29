/**
 * Minimal mock HTTP server for integration specs: serves a WHATWG
 * `(Request) => Response` handler on `node:http`. Binds to all interfaces.
 */

import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

export interface MockHttpServer {
	shutdown(): Promise<void>;
}

export type MockHttpHandler = (req: Request) => Response | Promise<Response>;

async function readBody(req: IncomingMessage): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of req) {
		chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer));
	}
	return Buffer.concat(chunks);
}

async function toRequest(req: IncomingMessage, port: number): Promise<Request> {
	const method = req.method ?? 'GET';
	const headers = new Headers();
	for (const [name, value] of Object.entries(req.headers)) {
		if (value === undefined) continue;
		if (Array.isArray(value)) {
			for (const v of value) headers.append(name, v);
		} else {
			headers.set(name, value);
		}
	}
	const body = method === 'GET' || method === 'HEAD' ? undefined : await readBody(req);
	return new Request(`http://localhost:${port}${req.url ?? '/'}`, { method, headers, body });
}

async function writeResponse(res: ServerResponse, response: Response): Promise<void> {
	const headers: Record<string, string | string[]> = {};
	response.headers.forEach((value, name) => {
		if (name !== 'set-cookie') headers[name] = value;
	});
	const setCookies = response.headers.getSetCookie();
	if (setCookies.length > 0) headers['set-cookie'] = setCookies;
	res.writeHead(response.status, response.statusText, headers);
	const body = response.body ? Buffer.from(await response.arrayBuffer()) : undefined;
	res.end(body);
}

/**
 * Start a server on `port` that answers every request with `handler`.
 * Resolves once the server is listening.
 */
export function serve(port: number, handler: MockHttpHandler): Promise<MockHttpServer> {
	const server = createServer((req, res) => {
		(async () => {
			try {
				const response = await handler(await toRequest(req, port));
				await writeResponse(res, response);
			} catch (err) {
				console.error(`[mock :${port}] handler error:`, err);
				if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
				res.end('Internal Server Error');
			}
		})();
	});

	return new Promise((resolve, reject) => {
		server.once('error', reject);
		server.listen(port, () => {
			server.off('error', reject);
			resolve({
				shutdown: () =>
					new Promise<void>((done, fail) => {
						server.closeAllConnections();
						server.close((err) => (err ? fail(err) : done()));
					})
			});
		});
	});
}
