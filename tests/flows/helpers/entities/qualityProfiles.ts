/**
 * Typed readers for the Quality Profiles pages. Each returns what the page's
 * server load sent, typed with the app's own types. Fields keep the app's
 * names: schema columns in snake_case, extras the app adds in camelCase.
 *
 * A language's `type` is deprecated and always "simple"; the older "must",
 * "only" and "not" types are no longer used.
 *
 * `setProfileScores` changes scores the way a user does, on the Scoring tab.
 */

import { expect, test, type Page } from '@playwright/test';
import { fillField, saveForm } from '#flows/helpers/core/forms.ts';
import { openEntity, openTab } from '#flows/helpers/core/nav.ts';
import type {
	QualitiesPageData,
	QualityProfileGeneral,
	QualityProfileScoring,
	QualityProfileTableRow
} from '#shared/pcd/display.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';

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

/** One custom format score to set on the Scoring tab */
export interface ProfileScore {
	/** The custom format's name */
	format: string;
	arr: 'Radarr' | 'Sonarr';
	score: number;
}

/** Profile scores to set alongside the format scores; anything left out stays */
export interface ProfileScoreSettings {
	minimumScore?: number;
}

/**
 * Open a quality profile's Scoring tab from the sidebar, set each format's
 * score for an Arr, turning the format on for that Arr first when it's off,
 * and the profile scores in `settings`. Then save. With developer access the
 * save is a base draft, otherwise a user op.
 */
export async function setProfileScores(
	page: Page,
	profile: string,
	scores: ProfileScore[],
	settings: ProfileScoreSettings = {}
): Promise<void> {
	const changes = scores.map(({ format, arr, score }) => `${format} ${arr} ${score}`);
	if (settings.minimumScore !== undefined) changes.push(`minimum ${settings.minimumScore}`);
	await test.step(
		`Set ${profile} scores: ${changes.join(', ')}`,
		async () => {
			await openEntity(page, 'Quality Profiles', profile);
			await openTab(page, 'Scoring');
			const main = page.getByRole('main');
			for (const { format, arr, score } of scores) {
				const enabled = main.getByRole('checkbox', {
					name: `${format} ${arr} enabled`,
					exact: true
				});
				await expect(enabled, `Scoring should list ${format} for ${arr}`).toBeVisible();
				if ((await enabled.getAttribute('aria-checked')) !== 'true') await enabled.click();
				await expect(enabled, `${format} should be on for ${arr}`).toHaveAttribute(
					'aria-checked',
					'true'
				);
				await fillField(main, `${format} ${arr} score`, score);
			}
			if (settings.minimumScore !== undefined) {
				await fillField(main, 'Minimum Score', settings.minimumScore);
			}
			await saveForm(page);
		},
		{ box: true }
	);
}
