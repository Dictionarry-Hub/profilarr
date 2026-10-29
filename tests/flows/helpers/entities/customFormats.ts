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
} from '#shared/pcd/display.ts';
import type { ProfileRef } from '#pcd/references.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { fixture, type FixtureCondition } from '#flows/helpers/core/fixtureData.ts';

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

/**
 * A fixture condition in the shape `customFormatPages.conditions()` returns,
 * to compare a stored condition with the snapshot. Pattern conditions get the
 * regular expression's pattern from the fixtures. Fields the condition's type
 * doesn't use are left out, where the page sends them as undefined.
 */
export function conditionFromFixture(condition: FixtureCondition): ConditionData {
	const { name, type, arrType, negate, required } = condition;
	const value = condition.value ?? {};
	const base: ConditionData = { name, type, arrType, negate, required };
	switch (type) {
		case 'release_title':
		case 'release_group':
		case 'edition': {
			const regex = fixture.regularExpression(value.regularExpressionName as string);
			return { ...base, patterns: [{ name: regex.name, pattern: regex.pattern }] };
		}
		case 'language':
			return {
				...base,
				languages: [{ name: value.languageName as string, except: value.exceptLanguage as boolean }]
			};
		case 'source':
			return { ...base, sources: [value.source as string] };
		case 'resolution':
			return { ...base, resolutions: [value.resolution as string] };
		case 'quality_modifier':
			return { ...base, qualityModifiers: [value.qualityModifier as string] };
		case 'release_type':
			return { ...base, releaseTypes: [value.releaseType as string] };
		case 'indexer_flag':
			return { ...base, indexerFlags: [value.flag as string] };
		case 'size':
			return {
				...base,
				size: {
					minBytes: value.minBytes as number | null,
					maxBytes: value.maxBytes as number | null
				}
			};
		case 'year':
			return {
				...base,
				years: { minYear: value.minYear as number | null, maxYear: value.maxYear as number | null }
			};
		default:
			throw new Error(`conditionFromFixture doesn't know condition type "${type}"`);
	}
}
