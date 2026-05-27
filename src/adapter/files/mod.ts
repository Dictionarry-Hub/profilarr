import { serveDir, serveFile } from 'jsr:@std/http@1/file-server';
import { dirname, extname, fromFileUrl, join } from 'jsr:@std/path@1';

import { logger } from '$logger/logger.ts';
import server from 'SERVER';

const initialized = server.init({ env: Deno.env.toObject() });

const prerendered: Set<string> = new Set(PRERENDERED);

const appDir = 'APP_DIR';
const baseDir = dirname(CURRENT_DIRNAME);
const rootDir = join(baseDir, 'static');

// ORIGIN env: rewrite request URLs so SvelteKit sees the external origin.
// This is required for CSRF checks and correct URL construction behind
// reverse proxies. Equivalent to adapter-node's ORIGIN support.
// Strip trailing slashes so `${ORIGIN}${pathname}` doesn't produce `//path`.
const ORIGIN = Deno.env.get('ORIGIN')?.replace(/\/+$/, '') || undefined;

Deno.serve(
	{
		port: Number.parseInt(Deno.env.get('PORT') ?? '6868'),
		hostname: Deno.env.get('HOST') ?? '0.0.0.0'
	},
	async (request: Request, info: Deno.ServeHandlerInfo<Deno.NetAddr>): Promise<Response> => {
		// Real TCP address — never trust client-supplied headers at the adapter level.
		// Proxy header logic (X-Forwarded-For etc.) is handled by getClientIp() in
		// the application layer where trustProxy can be controlled per-use.
		const clientAddress = info.remoteAddr.hostname;

		const { pathname } = new URL(request.url);

		// Path has trailing slash
		const slashed = pathname.at(-1) === '/';

		// Handle trailing slash redirects for prerendered routes
		const location = slashed ? pathname.slice(0, -1) : `${pathname}/`;
		if (prerendered.has(location)) {
			return new Response(null, {
				status: 308,
				statusText: 'Permanent Redirect',
				headers: {
					location
				}
			});
		}

		// Try prerendered route with html extension
		if (!slashed && !extname(pathname) && prerendered.has(pathname)) {
			const response = await serveFile(request, join(rootDir, `${pathname}.html`));
			if (response.ok || response.status === 304) {
				return response;
			}
		}

		// Try static files (ignore redirects and errors)
		const response = await serveDir(request, {
			fsRoot: rootDir,
			quiet: true
		});
		if (response.ok || response.status === 304) {
			if (pathname.startsWith(`/${appDir}/immutable/`) && response.status === 200) {
				response.headers.set('cache-control', 'public, max-age=31536000, immutable');
			}
			return response;
		}

		// Pass to the SvelteKit server
		await initialized;

		// Rewrite request URL if ORIGIN is set (reverse proxy support)
		let req = request;
		if (ORIGIN) {
			const url = new URL(request.url);
			req = new Request(`${ORIGIN}${url.pathname}${url.search}`, request);
		}

		const sveltekitResponse = await server.respond(req, {
			getClientAddress: () => clientAddress
		});

		logIfCsrfBlocked(sveltekitResponse, req);

		return sveltekitResponse;
	}
);

// SvelteKit's CSRF middleware runs inside server.respond() and returns a 403
// before the handle hook, so hooks.server.ts can't observe it. Detect it here
// so operators behind a misconfigured reverse proxy get an actionable log.
function logIfCsrfBlocked(response: Response, request: Request): void {
	if (response.status !== 403) return;
	response
		.clone()
		.text()
		.then((body) => {
			if (!body.includes('Cross-site POST form submissions are forbidden')) return;
			const url = new URL(request.url);
			logger.warn(`CSRF blocked ${request.method} ${url.pathname}`, {
				source: 'Auth:CSRF',
				meta: {
					origin: request.headers.get('origin'),
					expectedOrigin: url.origin,
					hint: 'If behind a reverse proxy, set the ORIGIN env var to the external URL (scheme + host + port, no trailing slash).'
				}
			});
		})
		.catch(() => {});
}
