import { redirect } from '$utils/redirect/redirect.ts';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async () => {
	throw redirect(302, '/dev/components');
};
