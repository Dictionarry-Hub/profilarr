import { serveDir, serveFile } from 'jsr:@std/http@1/file-server';
import { dirname, extname, fromFileUrl, join } from 'jsr:@std/path@1';

import { logger } from '$logger/logger.ts';
import { stripBaseUrl } from '$shared/baseUrl.ts';
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

// BASE_URL env: the subpath Profilarr is served from behind a reverse proxy, for
// example /profilarr. Requests arrive carrying the prefix. Everything downstream,
// meaning static files, prerendered routes and SvelteKit's router, works in paths
// without the prefix, so it is stripped here. Outgoing URLs are made relative to the
// base by SvelteKit itself (paths.relative), so the browser resolves them back under
// the prefix.
//
// When BASE_URL is set the app is served *only* from that subpath: anything outside
// it gets a 404, the same as Radarr and Sonarr. Reverse proxies must pass the prefix
// through rather than stripping it.
const BASE_URL = Deno.env.get('BASE_URL') ?? '';

Deno.serve(
	{
		port: Number.parseInt(Deno.env.get('PORT') ?? '8000'),
		hostname: Deno.env.get('HOST') ?? '0.0.0.0'
	},
	async (request: Request, info: Deno.ServeHandlerInfo<Deno.NetAddr>): Promise<Response> => {
		// Real TCP address — never trust client-supplied headers at the adapter level.
		// Proxy header logic (X-Forwarded-For etc.) is handled by getClientIp() in
		// the application layer where trustProxy can be controlled per-use.
		const clientAddress = info.remoteAddr.hostname;

		const url = new URL(request.url);

		// Normalise the request once, up front: drop the base URL prefix so routing,
		// static files and prerendered lookups all work in prefix-free paths, and swap
		// in ORIGIN so SvelteKit sees the origin the browser used. A path outside the
		// base isn't ours to serve.
		const pathname = stripBaseUrl(url.pathname, BASE_URL);
		if (pathname === null) return notFound();

		const target = `${ORIGIN ?? url.origin}${pathname}${url.search}`;
		const req = target === request.url ? request : new Request(target, request);

		// Path has trailing slash
		const slashed = pathname.at(-1) === '/';

		// Handle trailing slash redirects for prerendered routes. The Location header
		// is browser-facing, so it goes back out with the base URL attached.
		const location = slashed ? pathname.slice(0, -1) : `${pathname}/`;
		if (prerendered.has(location)) {
			return new Response(null, {
				status: 308,
				statusText: 'Permanent Redirect',
				headers: {
					location: `${BASE_URL}${location}`
				}
			});
		}

		// Try prerendered route with html extension
		if (!slashed && !extname(pathname) && prerendered.has(pathname)) {
			const response = await serveFile(req, join(rootDir, `${pathname}.html`));
			if (response.ok || response.status === 304) {
				return response;
			}
		}

		// Try static files (ignore redirects and errors)
		const response = await serveDir(req, {
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

		const sveltekitResponse = await server.respond(req, {
			getClientAddress: () => clientAddress
		});

		logIfCsrfBlocked(sveltekitResponse, req);

		return sveltekitResponse;
	}
);

/**
 * 404 for requests that fall outside BASE_URL.
 *
 * Deliberately plain text rather than SvelteKit's error page: the app is mounted at
 * the subpath, so rendering its error page here would emit asset URLs relative to a
 * location the app doesn't serve.
 */
function notFound(): Response {
	return new Response('Not Found\n', {
		status: 404,
		headers: { 'content-type': 'text/plain; charset=utf-8' }
	});
}

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
