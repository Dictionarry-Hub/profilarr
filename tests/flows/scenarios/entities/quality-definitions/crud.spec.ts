/**
 * - Protects: every Radarr and Sonarr quality definitions save, from the form
 *   action through the ops it writes to the cache rebuilt from them.
 * - A config is one row per quality tier.
 * - The form shows "unlimited" as the scale's top and stores it as 0, so the
 *   checks compare every tier, not only the ones the user changed.
 * - Every save returns to the quality definitions list.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '#flows/helpers/core/test.ts';
import {
	fixture,
	fixtures,
	type ArrType,
	type FixtureQualityDefinitions
} from '#flows/helpers/core/fixtureData.ts';
import { deleteEntity, fillField, saveForm } from '#flows/helpers/core/forms.ts';
import { newEntity, openEntity } from '#flows/helpers/core/nav.ts';
import { qualityDefinitionsPages } from '#flows/helpers/entities/mediaManagement.ts';
import type { QualityDefinitionEntry } from '#shared/pcd/display.ts';

const FIXTURE = {
	radarr: fixture.qualityDefinitions('radarr', 'Fixture Radarr'),
	sonarr: fixture.qualityDefinitions('sonarr', 'Fixture Sonarr')
};
const ARRS = ['radarr', 'sonarr'] as const satisfies ArrType[];
const LABEL = { radarr: 'Radarr', sonarr: 'Sonarr' } as const;

type Tier = FixtureQualityDefinitions['qualities'][number];
type Sizes = Pick<Tier, 'minSize' | 'preferredSize'> & Partial<Pick<Tier, 'maxSize'>>;

/** What each update test changes: two qualities in two resolution rows */
const UPDATES: Record<ArrType, { row: string; quality: string; sizes: Sizes }[]> = {
	radarr: [
		{
			row: 'Full HD (1080p)',
			quality: 'Bluray-1080p',
			sizes: { minSize: 25, preferredSize: 70, maxSize: 120 }
		},
		{
			row: '4K Ultra HD (2160p)',
			quality: 'Remux-2160p',
			sizes: { minSize: 150, preferredSize: 1600 }
		}
	],
	sonarr: [
		{ row: 'HD (720p)', quality: 'HDTV-720p', sizes: { minSize: 5, preferredSize: 20 } },
		{ row: 'Full HD (1080p)', quality: 'WEBDL-1080p', sizes: { minSize: 8, preferredSize: 40 } }
	]
};

/** Stored entries in the fixtures' shape, sorted by quality */
function asTiers(entries: QualityDefinitionEntry[]): Tier[] {
	return entries
		.map((entry) => ({
			qualityName: entry.quality_name,
			minSize: entry.min_size,
			maxSize: entry.max_size,
			preferredSize: entry.preferred_size
		}))
		.sort((a, b) => a.qualityName.localeCompare(b.qualityName));
}

const sortTiers = (tiers: Tier[]) =>
	[...tiers].sort((a, b) => a.qualityName.localeCompare(b.qualityName));

/** Every config on the list, as "arr/name" */
async function listed(page: Page): Promise<string[]> {
	const configs = await qualityDefinitionsPages.list(page);
	return configs.map((config) => `${config.arr_type}/${config.name}`).sort();
}

/** Expand a resolution row with its own Expand button */
async function expandRow(page: Page, label: string): Promise<void> {
	const row = page
		.getByRole('main')
		.getByRole('row')
		.filter({ has: page.getByRole('cell', { name: label, exact: true }) });
	await row.getByRole('button', { name: 'Expand', exact: true }).click();
}

for (const arr of ARRS) {
	const other = arr === 'radarr' ? 'sonarr' : 'radarr';

	/**
	 * Flow:
	 * 1. The user starts a new config for the Arr, fills Name and clicks
	 *    Create.
	 * 2. The user opens the new config.
	 *
	 * Expects:
	 * - there is one entry per quality the Arr has
	 * - every entry is 0 / 0 / 0
	 */
	test(`creates a ${LABEL[arr]} config with every quality unsized`, async ({ page }) => {
		const name = `Flow ${LABEL[arr]} Definitions`;
		await newEntity(page, 'Quality Definitions', LABEL[arr]);
		await fillField(page.getByRole('main'), 'Name', name);
		await saveForm(page, { button: 'Create' });

		await openEntity(page, 'Quality Definitions', name);
		const { config, availableQualities } = await qualityDefinitionsPages.entity(page);
		expect(
			asTiers(config.entries),
			'every quality the Arr has should get one entry, all sizes 0'
		).toEqual(
			[...availableQualities]
				.sort((a, b) => a.localeCompare(b))
				.map((qualityName) => ({ qualityName, minSize: 0, maxSize: 0, preferredSize: 0 }))
		);
	});

	/**
	 * Flow:
	 * 1. The user opens the fixture config.
	 * 2. In two resolution rows, the user expands the row and changes one
	 *    quality's sizes, pressing Tab after each value.
	 * 3. The user clicks Save and lands on the list.
	 * 4. The user opens the config again.
	 *
	 * Expects:
	 * - both changed tiers are stored exactly
	 * - every other tier matches the fixture
	 */
	test(`updates two tiers of a ${LABEL[arr]} config in one save`, async ({ page }) => {
		await openEntity(page, 'Quality Definitions', FIXTURE[arr].name);
		const main = page.getByRole('main');
		for (const { row, quality, sizes } of UPDATES[arr]) {
			await expandRow(page, row);
			await fillField(main, `${quality} Min`, sizes.minSize);
			await fillField(main, `${quality} Preferred`, sizes.preferredSize);
			if (sizes.maxSize !== undefined) await fillField(main, `${quality} Max`, sizes.maxSize);
		}
		await saveForm(page);

		await openEntity(page, 'Quality Definitions', FIXTURE[arr].name);
		const { config } = await qualityDefinitionsPages.entity(page);
		const expected = FIXTURE[arr].qualities.map((tier) => {
			const update = UPDATES[arr].find((u) => u.quality === tier.qualityName);
			return update ? { ...tier, ...update.sizes } : tier;
		});
		expect(
			asTiers(config.entries),
			'the changed tiers should be stored exactly and the rest match the fixture'
		).toEqual(sortTiers(expected));
	});

	/**
	 * Flow:
	 * 1. The user opens the fixture config, changes its name and clicks Save.
	 * 2. The user opens the config under its new name.
	 *
	 * Expects:
	 * - the list has the new name, and not the old one
	 * - the entries match the fixture
	 */
	test(`renames a ${LABEL[arr]} config and keeps its tiers`, async ({ page }) => {
		const renamed = `Renamed ${LABEL[arr]} Definitions`;
		await openEntity(page, 'Quality Definitions', FIXTURE[arr].name);
		await fillField(page.getByRole('main'), 'Name', renamed);
		await saveForm(page);

		const names = await listed(page);
		expect(names, 'the list should have the new name').toContain(`${arr}/${renamed}`);
		expect(names, 'the list should not have the old name').not.toContain(
			`${arr}/${FIXTURE[arr].name}`
		);
		await openEntity(page, 'Quality Definitions', renamed);
		const { config } = await qualityDefinitionsPages.entity(page);
		expect(asTiers(config.entries), 'the entries should match the fixture').toEqual(
			sortTiers(FIXTURE[arr].qualities)
		);
	});

	/**
	 * Flow:
	 * 1. The user opens the fixture config and deletes it.
	 *
	 * Expects:
	 * - the list keeps only the other Arr's configs
	 */
	test(`deletes a ${LABEL[arr]} config`, async ({ page }) => {
		await openEntity(page, 'Quality Definitions', FIXTURE[arr].name);
		await deleteEntity(page);

		expect(await listed(page), `only the ${LABEL[other]} configs should be left`).toEqual(
			fixtures.qualityDefinitions[other].map((config) => `${other}/${config.name}`).sort()
		);
	});
}
