import { page as pageState, type Page } from '$app/state';
import { toStore, type Readable } from 'svelte/store';

// `$app/stores` was removed in SvelteKit 3, and `$app/state` only reports
// changes to runes. This store keeps `$page` working in non-runes components.
// The store is created per subscription because `$app/state` can only be read
// during component init on the server.
function snapshot(): Page {
	return {
		url: pageState.url,
		params: pageState.params,
		route: pageState.route,
		status: pageState.status,
		error: pageState.error,
		data: pageState.data,
		form: pageState.form,
		state: pageState.state,
		shallow: pageState.shallow
	};
}

export const page: Readable<Page> = {
	subscribe(run, invalidate) {
		return toStore(snapshot).subscribe(run, invalidate);
	}
};
