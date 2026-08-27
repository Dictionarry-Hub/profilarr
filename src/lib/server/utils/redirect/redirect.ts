/**
 * Redirect that is aware of the base URL.
 *
 * Drop in replacement for SvelteKit's `redirect()`. Server side code sees paths without
 * the prefix, because the adapter strips BASE_URL off incoming requests, but a Location
 * header faces the browser and must carry the prefix back. Otherwise a reverse proxy
 * serving Profilarr from /profilarr would send the user to /auth/login on the proxy
 * root.
 *
 * External URLs and paths that already carry the prefix pass through untouched.
 *
 * Use this everywhere in server code instead of importing `redirect` from
 * '@sveltejs/kit'. `deno task lint:base-url` enforces it.
 */

import { redirect as kitRedirect } from '@sveltejs/kit';
import { config } from '$config';
import { withBaseUrl } from '$shared/baseUrl.ts';

type RedirectStatus = Parameters<typeof kitRedirect>[0];

export function redirect(status: RedirectStatus, location: string | URL): never {
	if (typeof location !== 'string') {
		return kitRedirect(status, location);
	}
	return kitRedirect(status, withBaseUrl(location, config.baseUrl));
}
