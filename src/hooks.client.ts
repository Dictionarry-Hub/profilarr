import { alertStore } from '$alerts/store';

// SvelteKit's CSRF middleware rejects cross-site POST/PUT/PATCH/DELETE with a
// raw 403 that bypasses form actions, so `use:enhance` callbacks never see a
// typed failure and the UI silently no-ops. Patch fetch to detect this body,
// mirror the adapter's server-side check (src/adapter/files/mod.ts), and
// surface a persistent alert pointing at the ORIGIN env fix.

const CSRF_ALERT_MESSAGE =
	'Request blocked: origin mismatch. If running behind a reverse proxy, ensure the ORIGIN env var matches the external URL (scheme + host + port). See server logs for details.';

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
