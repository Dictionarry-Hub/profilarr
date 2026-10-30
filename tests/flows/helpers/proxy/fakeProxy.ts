/**
 * A fake reverse proxy for flow tests. It runs in the test process on a free
 * port and forwards to the test's app, adding the headers a typical proxy
 * adds: `X-Forwarded-For`, `X-Forwarded-Proto` and `X-Forwarded-Host`.
 *
 * Options turn on HTTPS, change request headers, or reproduce nginx's 502 for
 * oversized response headers (proxies.ts). Every request is recorded with the
 * headers the app received and the status the browser got.
 */

import { createServer as createHttpServer, request, type IncomingMessage } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import type { ServerResponse } from 'node:http';
import { freePort } from '#flows/harness/ports.ts';
import { certificate } from '#flows/harness/tls.ts';
import type { ProxiedRequest, ProxyOptions, ReverseProxy, RunningProxy } from './proxies.ts';

/** Bytes in a response's status line and headers, as a proxy buffers them */
function headerBytes(response: IncomingMessage): number {
	let bytes = `HTTP/1.1 ${response.statusCode} ${response.statusMessage}\r\n`.length;
	for (let i = 0; i < response.rawHeaders.length; i += 2) {
		bytes += `${response.rawHeaders[i]}: ${response.rawHeaders[i + 1]}\r\n`.length;
	}
	return bytes + 2;
}

async function startFakeProxy(options: ProxyOptions): Promise<RunningProxy> {
	const port = await freePort();
	const scheme = options.tls ? 'https' : 'http';
	const url = `${scheme}://${options.publicHost ?? '127.0.0.1'}:${port}`;
	const requests: ProxiedRequest[] = [];
	let appUrl: URL | null = null;
	let failure: number | null = null;

	function answer(res: ServerResponse, entry: ProxiedRequest, status: number, text: string) {
		entry.status = status;
		res.writeHead(status, { 'Content-Type': 'text/plain' });
		res.end(text);
	}

	function handle(req: IncomingMessage, res: ServerResponse): void {
		const headers: Record<string, string> = {};
		for (const [name, value] of Object.entries(req.headers)) {
			if (value !== undefined) headers[name] = Array.isArray(value) ? value.join(', ') : value;
		}
		const client = req.socket.remoteAddress ?? '127.0.0.1';
		headers['x-forwarded-for'] = headers['x-forwarded-for']
			? `${headers['x-forwarded-for']}, ${client}`
			: client;
		headers['x-forwarded-proto'] = scheme;
		headers['x-forwarded-host'] = headers.host ?? `127.0.0.1:${port}`;
		for (const [name, value] of Object.entries(options.headers ?? {})) {
			if (value === null) delete headers[name.toLowerCase()];
			else headers[name.toLowerCase()] = value;
		}

		const entry: ProxiedRequest = {
			method: req.method ?? 'GET',
			path: req.url ?? '/',
			headers,
			status: 0
		};
		requests.push(entry);

		if (failure !== null) return answer(res, entry, failure, 'Failed by test');
		if (!appUrl) return answer(res, entry, 502, 'No app behind the proxy yet');

		const upstream = request(
			{
				host: appUrl.hostname,
				port: appUrl.port,
				method: req.method,
				path: req.url,
				headers
			},
			(response) => {
				if (
					options.maxResponseHeaderBytes !== undefined &&
					headerBytes(response) > options.maxResponseHeaderBytes
				) {
					response.resume();
					return answer(res, entry, 502, 'Upstream sent too big header');
				}
				entry.status = response.statusCode ?? 0;
				res.writeHead(entry.status, response.headers);
				response.pipe(res);
			}
		);
		upstream.on('error', () => answer(res, entry, 502, 'App unreachable'));
		req.pipe(upstream);
	}

	const server = options.tls ? createHttpsServer(certificate(), handle) : createHttpServer(handle);
	await new Promise<void>((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

	return {
		proxy: fakeProxy,
		url,
		requests,
		target: async (next) => {
			appUrl = new URL(next);
		},
		fail: (status) => {
			failure = status;
		},
		stop: () =>
			new Promise<void>((resolveStop) => {
				server.close(() => resolveStop());
				server.closeAllConnections();
			})
	};
}

export const fakeProxy: ReverseProxy = {
	id: 'fake',
	label: 'Fake reverse proxy',
	needsDocker: false,
	supports: ['tls', 'headers', 'maxResponseHeaderBytes', 'fail'],
	start: startFakeProxy
};
