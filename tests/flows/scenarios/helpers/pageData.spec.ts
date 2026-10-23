import { test, expect } from '$flows/helpers/test.ts';
import { fixture } from '$flows/helpers/fixtureData.ts';
import { openEntity, openTab } from '$flows/helpers/nav.ts';
import { camelKeys, pageData, pick, unflatten } from '$flows/helpers/pageData.ts';

interface ScoringData {
	scoring: { customFormats: { name: string; scores: Record<string, number | null> }[] };
}

test('pageData reads the scoring page the app served', async ({ page }) => {
	const profile = fixture.qualityProfile('Radarr Profile');
	await openEntity(page, 'Quality Profiles', profile.name);
	await openTab(page, 'Scoring');

	const data = await pageData<ScoringData>(page);
	for (const { customFormatName, arrType, score } of profile.scores) {
		const format = data.scoring.customFormats.find((f) => f.name === customFormatName);
		expect(format?.scores[arrType], `${customFormatName} ${arrType} score`).toBe(score);
	}
});

// Doesn't start the app: checks the decoder on values JSON can't hold
test('unflatten decodes devalue special values', () => {
	const decoded = unflatten([
		{ when: 1, tags: 2, sizes: 3, missing: -1, nothing: 6 },
		['Date', '2026-10-22T00:00:00.000Z'],
		['Set', 4],
		['Map', 4, 5],
		'alpha',
		10,
		null
	]) as {
		when: Date;
		tags: Set<string>;
		sizes: Map<string, number>;
		missing: undefined;
		nothing: null;
	};

	expect(decoded.when.toISOString()).toBe('2026-10-22T00:00:00.000Z');
	expect([...decoded.tags]).toEqual(['alpha']);
	expect(decoded.sizes.get('alpha')).toBe(10);
	expect(decoded.missing).toBeUndefined();
	expect(decoded.nothing).toBeNull();
});

// Doesn't start the app: plain functions for comparing page data with the snapshot
test('camelKeys renames snake_case keys and keeps values', () => {
	expect(camelKeys({ upgrade_until_score: 1000, name: 'Radarr Profile', min_size_mb: 5 })).toEqual({
		upgradeUntilScore: 1000,
		name: 'Radarr Profile',
		minSizeMb: 5
	});
});

test('pick keeps only the keys the expected object has', () => {
	expect(pick({ name: 'Title Regex', pattern: 'x', id: 7 }, { name: '', pattern: '' })).toEqual({
		name: 'Title Regex',
		pattern: 'x'
	});
	// A key missing from the page shows up as undefined, so the comparison fails on it
	expect(pick({ name: 'Title Regex' }, { name: '', pattern: '' })).toEqual({
		name: 'Title Regex',
		pattern: undefined
	});
});
