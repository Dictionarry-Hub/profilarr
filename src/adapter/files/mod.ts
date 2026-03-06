import { serveDir, serveFile } from 'jsr:@std/http@1/file-server';
import { dirname, extname, fromFileUrl, join } from 'jsr:@std/path@1';

import server from 'SERVER';

const initialized = server.init({ env: Deno.env.toObject() });

const prerendered: Set<string> = new Set(PRERENDERED);

const appDir = 'APP_DIR';
const baseDir = dirname(CURRENT_DIRNAME);
const rootDir = join(baseDir, 'static');

// ORIGIN env: rewrite request URLs so SvelteKit sees the external origin.
// This is required for CSRF checks and correct URL construction behind
// reverse proxies. Equivalent to adapter-node's ORIGIN support.
const ORIGIN = Deno.env.get('ORIGIN');

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

		return server.respond(req, {
			getClientAddress: () => clientAddress
		});
	}
);
