import { redirect } from '$utils/redirect/redirect.ts';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	if (import.meta.env.VITE_CHANNEL !== 'dev') {
		throw redirect(302, '/');
	}
};
