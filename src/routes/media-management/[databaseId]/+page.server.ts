import { redirect } from '$utils/redirect/redirect.ts';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
	// Redirect to naming settings by default
	throw redirect(302, `/media-management/${params.databaseId}/naming`);
};
