import { test, expect } from '#flows/helpers/core/test.ts';
import { fixture } from '#flows/helpers/core/fixtureData.ts';
import { saveForm } from '#flows/helpers/core/forms.ts';
import { openEntity, openTab } from '#flows/helpers/core/nav.ts';
import { pageData } from '#flows/helpers/core/pageData.ts';
import { setScreen } from '#flows/helpers/core/screen.ts';

interface QualitiesPage {
	qualities: { orderedItems: { name: string }[] };
}

// The move arrows only show on small screens; desktop reorders by dragging
test('a quality moves down with its arrow button on a small screen', async ({ page }) => {
	const [first, second] = fixture.qualityProfile('Radarr Profile').qualities;
	await openEntity(page, 'Quality Profiles', 'Radarr Profile');
	await openTab(page, 'Qualities');
	await setScreen(page, 'mobile');

	await page
		.getByRole('main')
		.getByRole('button', { name: `Move ${first.name} down`, exact: true })
		.click();
	await saveForm(page);

	const order = (await pageData<QualitiesPage>(page)).qualities.orderedItems.map((q) => q.name);
	expect(order.slice(0, 2), 'the first two qualities swap places').toEqual([
		second.name,
		first.name
	]);
});
