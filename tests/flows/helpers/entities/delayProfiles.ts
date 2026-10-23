/**
 * Typed readers for the Delay Profiles pages. Each returns what the page's
 * server load sent, typed with the app's own types. Fields keep the app's
 * names, which follow the PCD schema (`preferred_protocol`, `usenet_delay`).
 * Delays are in minutes, whatever unit the form shows.
 */

import type { Page } from '@playwright/test';
import type { DelayProfilesRow } from '$shared/pcd/display.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';

export const delayProfilePages = {
	/** Every delay profile on a list page, `/delay-profiles/{databaseId}` */
	async list(page: Page, path?: string): Promise<DelayProfilesRow[]> {
		const data = await pageData<{ delayProfiles: DelayProfilesRow[] }>(page, path);
		return data.delayProfiles;
	},

	/** One delay profile, `/delay-profiles/{databaseId}/{name}` */
	async entity(page: Page, path?: string): Promise<DelayProfilesRow> {
		const data = await pageData<{ delayProfile: DelayProfilesRow }>(page, path);
		return data.delayProfile;
	}
};
