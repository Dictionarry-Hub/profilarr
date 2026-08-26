import { redirect } from '$utils/redirect/redirect.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
	redirect(302, '/databases');
};
