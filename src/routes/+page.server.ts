import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { generalSettingsQueries } from '#db/queries/generalSettings.ts';
import { pcdManager } from '#pcd/core/manager.ts';
import { resolveLandingPage } from '#shared/landingPages.ts';

export const load: PageServerLoad = async () => {
	const preference = generalSettingsQueries.get()?.landing_page;
	redirect(302, resolveLandingPage(preference, pcdManager.getAll().length > 0));
};
