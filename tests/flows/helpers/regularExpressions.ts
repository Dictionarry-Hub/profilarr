/**
 * Typed readers for the Regular Expressions pages. Each returns what the
 * page's server load sent, typed with the app's own types, so scenarios don't
 * declare page shapes themselves. Fields keep the app's names, which follow
 * the PCD schema (`regex101_id`, `created_at`).
 */

import type { Page } from '@playwright/test';
import type { RegularExpressionWithTags } from '$shared/pcd/display.ts';
import type { ConditionRef } from '$pcd/references.ts';
import { pageData } from '$flows/helpers/pageData.ts';

/** A custom format condition that uses the regular expression */
export type { ConditionRef };

export interface RegularExpressionPage {
	regularExpression: RegularExpressionWithTags;
	conditionRefs: ConditionRef[];
}

export const regularExpressionPages = {
	/** Every regular expression on a list page, `/regular-expressions/{databaseId}` */
	async list(page: Page, path?: string): Promise<RegularExpressionWithTags[]> {
		const data = await pageData<{ regularExpressions: RegularExpressionWithTags[] }>(page, path);
		return data.regularExpressions;
	},

	/** One regular expression and the conditions using it, `/regular-expressions/{databaseId}/{id}` */
	async entity(page: Page, path?: string): Promise<RegularExpressionPage> {
		const data = await pageData<RegularExpressionPage>(page, path);
		return { regularExpression: data.regularExpression, conditionRefs: data.conditionRefs };
	}
};
