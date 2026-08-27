import { redirect } from '$utils/redirect/redirect.ts';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ params }) => {
	// Redirect to the general tab by default
	throw redirect(303, `/custom-formats/${params.databaseId}/${params.id}/general`);
};
