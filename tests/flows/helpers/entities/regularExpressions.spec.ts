/**
 * Checks for the readers in helpers/entities/regularExpressions.ts.
 */
import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture, fixtures } from '#flows/helpers/core/fixtureData.ts';
import { openEntity, openSidebarPage } from '#flows/helpers/core/nav.ts';
import { regularExpressionPages } from './regularExpressions.ts';

test('list reads every regular expression', async ({ page }) => {
	await openSidebarPage(page, 'Regular Expressions');
	const names = (await regularExpressionPages.list(page)).map((regex) => regex.name);
	expect(names.sort()).toEqual(fixtures.regularExpressions.map((regex) => regex.name).sort());
});

test('entity reads a regular expression and the conditions using it', async ({ page }) => {
	const expected = fixture.regularExpression('Title Regex');
	await openEntity(page, 'Regular Expressions', expected.name);

	const { regularExpression, conditionRefs } = await regularExpressionPages.entity(page);
	expect(regularExpression.pattern).toBe(expected.pattern);
	expect(regularExpression.tags.map((tag) => tag.name)).toEqual(expected.tags);
	expect(conditionRefs.map((ref) => `${ref.cfName} › ${ref.conditionName}`)).toContain(
		'Title Match › Title'
	);
});
