/**
 * Typed readers for the Quality Profiles pages. Each returns what the page's
 * server load sent, typed with the app's own types. Fields keep the app's
 * names: schema columns in snake_case, extras the app adds in camelCase.
 *
 * A language's `type` is deprecated and always "simple"; the older "must",
 * "only" and "not" types are no longer used.
 */

import type { Page } from '@playwright/test';
import type {
	QualitiesPageData,
	QualityProfileGeneral,
	QualityProfileScoring,
	QualityProfileTableRow
} from '$shared/pcd/display.ts';
import { pageData } from '$flows/helpers/pageData.ts';

export const qualityProfilePages = {
	/** Every quality profile on a list page, `/quality-profiles/{databaseId}` */
	async list(page: Page, path?: string): Promise<QualityProfileTableRow[]> {
		const data = await pageData<{ qualityProfiles: QualityProfileTableRow[] }>(page, path);
		return data.qualityProfiles;
	},

	/** The General tab, `/quality-profiles/{databaseId}/{id}/general` */
	async general(page: Page, path?: string): Promise<QualityProfileGeneral> {
		const data = await pageData<{ profile: QualityProfileGeneral }>(page, path);
		return data.profile;
	},

	/** The Scoring tab, `/quality-profiles/{databaseId}/{id}/scoring` */
	async scoring(page: Page, path?: string): Promise<QualityProfileScoring> {
		const data = await pageData<{ scoring: QualityProfileScoring }>(page, path);
		return data.scoring;
	},

	/** The Qualities tab, in profile order, `/quality-profiles/{databaseId}/{id}/qualities` */
	async qualities(page: Page, path?: string): Promise<QualitiesPageData> {
		const data = await pageData<{ qualities: QualitiesPageData }>(page, path);
		return data.qualities;
	}
};
