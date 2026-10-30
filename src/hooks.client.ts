import { alertStore } from '#client/alerts/store.ts';

// SvelteKit's CSRF middleware rejects cross-site POST/PUT/PATCH/DELETE with a
// raw 403 that bypasses form actions, so `use:enhance` callbacks never see a
// typed failure and the UI silently no-ops. Patch fetch to detect this body,
// and surface a persistent alert pointing at the ORIGIN env fix. The server
// resolves each request's origin in src/runtime/server.js.

const CSRF_ALERT_MESSAGE =
	'Request blocked: origin mismatch. If running behind a reverse proxy, add the address in your address bar to the ORIGIN env var (scheme + host + port). See https://profilarr.com/installation#authentication';

const originalFetch = window.fetch;
window.fetch = async function patchedFetch(...args) {
	const response = await originalFetch.apply(this, args);
	if (response.status === 403) {
		response
			.clone()
			.text()
			.then((body) => {
				if (!body.includes('Cross-site') || !body.includes('form submissions are forbidden')) {
					return;
				}
				alertStore.add('warning', CSRF_ALERT_MESSAGE, 0);
			})
			.catch(() => {});
	}
	return response;
};
