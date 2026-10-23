/**
 * Typed readers for the Custom Formats pages. Each returns what the page's
 * server load sent, typed with the app's own types. Fields keep the app's
 * names: schema columns in snake_case, extras the app adds in camelCase.
 *
 * The Testing tab has no reader: it needs the parser, which flow tests don't
 * start.
 */

import type { Page } from '@playwright/test';
import type {
	ConditionData,
	CustomFormatBasic,
	CustomFormatGeneral,
	CustomFormatTableRow
} from '$shared/pcd/display.ts';
import type { ProfileRef } from '$pcd/references.ts';
import { pageData } from '$flows/helpers/pageData.ts';

/** A quality profile that scores the custom format */
export type { ProfileRef };

export interface CustomFormatGeneralPage {
	format: CustomFormatGeneral;
	profileRefs: ProfileRef[];
}

export interface CustomFormatConditionsPage {
	format: CustomFormatBasic;
	conditions: ConditionData[];
}

export const customFormatPages = {
	/** Every custom format on a list page, `/custom-formats/{databaseId}` */
	async list(page: Page, path?: string): Promise<CustomFormatTableRow[]> {
		const data = await pageData<{ customFormats: CustomFormatTableRow[] }>(page, path);
		return data.customFormats;
	},

	/** The General tab, `/custom-formats/{databaseId}/{id}/general` */
	async general(page: Page, path?: string): Promise<CustomFormatGeneralPage> {
		const data = await pageData<CustomFormatGeneralPage>(page, path);
		return { format: data.format, profileRefs: data.profileRefs };
	},

	/** The Conditions tab, `/custom-formats/{databaseId}/{id}/conditions` */
	async conditions(page: Page, path?: string): Promise<CustomFormatConditionsPage> {
		const data = await pageData<CustomFormatConditionsPage>(page, path);
		return { format: data.format, conditions: data.conditions };
	}
};
