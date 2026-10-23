/**
 * The fixtures contract: every entity in the snapshot (tests/flows/data/fixtures.json)
 * shows up in the running app with the same values. Scenarios rely on these
 * names and values, so a fixtures change that breaks them fails here first,
 * naming the entity and field.
 */
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import {
	fixtures,
	SONARR_WORDS,
	type ArrType,
	type FixtureCondition
} from '$flows/helpers/core/fixtureData.ts';
import { openEntity, openTab, type EntitySection } from '$flows/helpers/core/nav.ts';
import { camelKeys, pageData, pick, type Json } from '$flows/helpers/core/pageData.ts';
import type { Page } from '@playwright/test';

const tagNames = (tags: { name: string }[]) => tags.map((tag) => tag.name).sort();

async function open(page: Page, section: EntitySection, name: string): Promise<Json> {
	await openEntity(page, section, name);
	return pageData(page);
}

test('the fixtures database is linked and compiled', async ({ page, request }) => {
	const status = await request.get('/api/v1/status');
	expect(status.ok()).toBe(true);
	const body = (await status.json()) as {
		databases: { name: string; counts: Record<string, number> }[];
	};
	expect(body.databases.find((db) => db.name === FIXTURES_NAME)?.counts).toEqual({
		customFormats: fixtures.customFormats.length,
		qualityProfiles: fixtures.qualityProfiles.length,
		regularExpressions: fixtures.regularExpressions.length,
		delayProfiles: fixtures.delayProfiles.length
	});

	await page.goto('/databases');
	await expect(
		page.getByRole('main').getByRole('heading', { name: FIXTURES_NAME, exact: true })
	).toBeVisible();
});

test('regular expressions match the snapshot', async ({ page }) => {
	for (const expected of fixtures.regularExpressions) {
		const data = await open(page, 'Regular Expressions', expected.name);
		const regex = data.regularExpression as Json & { tags: { name: string }[] };
		const { tags, ...fields } = expected;
		expect(pick(camelKeys(regex), fields), expected.name).toEqual(fields);
		expect(tagNames(regex.tags), `${expected.name} tags`).toEqual(tags);
	}
});

/** A condition from the Conditions page, in the snapshot's shape */
function conditionValue(condition: Json): Json | null {
	const first = <T>(key: string) => (condition[key] as T[] | undefined)?.[0];
	switch (condition.type) {
		case 'release_title':
		case 'release_group':
		case 'edition':
			return { regularExpressionName: first<{ name: string }>('patterns')?.name };
		case 'language': {
			const language = first<{ name: string; except: boolean }>('languages');
			return { languageName: language?.name, exceptLanguage: language?.except };
		}
		case 'source':
			return { source: first('sources') };
		case 'resolution':
			return { resolution: first('resolutions') };
		case 'quality_modifier':
			return { qualityModifier: first('qualityModifiers') };
		case 'release_type':
			return { releaseType: first('releaseTypes') };
		case 'indexer_flag':
			return { flag: first('indexerFlags') };
		case 'size':
			return condition.size as Json;
		case 'year':
			return condition.years as Json;
		default:
			return null;
	}
}

test('custom formats match the snapshot', async ({ page }) => {
	for (const expected of fixtures.customFormats) {
		const data = await open(page, 'Custom Formats', expected.name);
		const format = data.format as Json & { tags: { name: string }[] };
		expect(format.description ?? '', `${expected.name} description`).toBe(
			expected.description ?? ''
		);
		expect(format.include_in_rename, `${expected.name} include in rename`).toBe(
			expected.includeInRename
		);
		expect(tagNames(format.tags), `${expected.name} tags`).toEqual(expected.tags);

		await openTab(page, 'Conditions');
		const conditions = ((await pageData(page)).conditions as Json[]).map(
			(condition): FixtureCondition => ({
				name: condition.name as string,
				type: condition.type as string,
				arrType: condition.arrType as FixtureCondition['arrType'],
				negate: condition.negate as boolean,
				required: condition.required as boolean,
				value: conditionValue(condition)
			})
		);
		const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);
		expect(conditions.sort(byName), `${expected.name} conditions`).toEqual(
			[...expected.conditions].sort(byName)
		);
		// Tests are on the Testing tab, which needs the parser that flow tests don't run
	}
});

test('quality profiles match the snapshot', async ({ page }) => {
	for (const expected of fixtures.qualityProfiles) {
		const general = await open(page, 'Quality Profiles', expected.name);
		const profile = general.profile as Json & { tags: { name: string }[]; language: string | null };
		// The page shows a missing description as an empty string
		expect(profile.description ?? '', `${expected.name} description`).toBe(
			expected.description ?? ''
		);
		expect(tagNames(profile.tags), `${expected.name} tags`).toEqual(expected.tags);
		expect(profile.language ?? null, `${expected.name} language`).toBe(
			expected.language?.languageName ?? null
		);

		await openTab(page, 'Scoring');
		const scoring = (await pageData(page)).scoring as Json & {
			customFormats: { name: string; scores: Record<string, number | null> }[];
		};
		expect(
			pick(camelKeys(scoring), {
				upgradesAllowed: 0,
				minimumCustomFormatScore: 0,
				upgradeUntilScore: 0,
				upgradeScoreIncrement: 0
			}),
			`${expected.name} upgrade settings`
		).toEqual({
			upgradesAllowed: expected.upgradesAllowed,
			minimumCustomFormatScore: expected.minimumCustomFormatScore,
			upgradeUntilScore: expected.upgradeUntilScore,
			upgradeScoreIncrement: expected.upgradeScoreIncrement
		});
		const scores = scoring.customFormats.flatMap((format) =>
			Object.entries(format.scores)
				.filter(([, score]) => score !== null)
				.map(([arrType, score]) => ({ customFormatName: format.name, arrType, score }))
		);
		const byScore = (a: { customFormatName: string; arrType: string }, b: typeof a) =>
			`${a.customFormatName}|${a.arrType}`.localeCompare(`${b.customFormatName}|${b.arrType}`);
		expect(scores.sort(byScore), `${expected.name} scores`).toEqual(
			[...expected.scores].sort(byScore)
		);

		await openTab(page, 'Qualities');
		const qualities = (
			(await pageData(page)).qualities as {
				orderedItems: {
					name: string;
					enabled: boolean;
					upgradeUntil: boolean;
					members?: { name: string }[];
				}[];
			}
		).orderedItems.map((item) => ({
			name: item.name,
			enabled: item.enabled,
			upgradeUntil: item.upgradeUntil,
			...(item.members ? { members: item.members.map((member) => member.name) } : {})
		}));
		expect(qualities, `${expected.name} qualities, in order`).toEqual(expected.qualities);
	}
});

test('delay profiles match the snapshot', async ({ page }) => {
	for (const expected of fixtures.delayProfiles) {
		const data = await open(page, 'Delay Profiles', expected.name);
		expect(pick(camelKeys(data.delayProfile as Json), expected), expected.name).toEqual(expected);
	}
});

test('naming configs match the snapshot', async ({ page }) => {
	for (const arr of ['radarr', 'sonarr'] as ArrType[]) {
		for (const stored of fixtures.naming[arr]) {
			const data = await open(page, 'Naming Settings', stored.name);
			const expected =
				arr === 'sonarr'
					? Object.fromEntries(
							Object.entries(stored).map(([key, value]) => [
								key,
								SONARR_WORDS[key] && typeof value === 'number' ? SONARR_WORDS[key][value] : value
							])
						)
					: stored;
			expect(pick(camelKeys(data.namingConfig as Json), expected), `${arr} ${stored.name}`).toEqual(
				expected
			);
		}
	}
});

test('media settings match the snapshot', async ({ page }) => {
	for (const arr of ['radarr', 'sonarr'] as ArrType[]) {
		for (const expected of fixtures.mediaSettings[arr]) {
			const data = await open(page, 'Media Settings', expected.name);
			expect(
				pick(camelKeys(data.mediaSettingsConfig as Json), expected),
				`${arr} ${expected.name}`
			).toEqual(expected);
		}
	}
});

// Plain code point order, so both sides sort the same way
const byQuality = (a: { qualityName: string }, b: { qualityName: string }) =>
	a.qualityName < b.qualityName ? -1 : a.qualityName > b.qualityName ? 1 : 0;

test('quality definitions match the snapshot', async ({ page }) => {
	for (const arr of ['radarr', 'sonarr'] as ArrType[]) {
		for (const expected of fixtures.qualityDefinitions[arr]) {
			const data = await open(page, 'Quality Definitions', expected.name);
			const entries = (
				(data.qualityDefinitionsConfig as { entries: Json[] }).entries.map(camelKeys) as {
					qualityName: string;
				}[]
			).sort(byQuality);
			expect(entries, `${arr} ${expected.name}`).toEqual([...expected.qualities].sort(byQuality));
		}
	}
});

test('quality names per Arr match the snapshot', async ({ page }) => {
	for (const arr of ['radarr', 'sonarr'] as ArrType[]) {
		// Each quality definitions page lists the qualities its Arr has
		const data = await open(page, 'Quality Definitions', fixtures.qualityDefinitions[arr][0].name);
		const available = [...(data.availableQualities as string[])].sort();
		expect(available, `${arr} qualities`).toEqual(
			Object.keys(fixtures.qualityApiNames[arr]).sort()
		);
	}
});
