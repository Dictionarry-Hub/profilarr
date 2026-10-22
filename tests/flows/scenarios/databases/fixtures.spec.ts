import { test, expect } from '$flows/helpers/test.ts';

test('the fixtures database is linked and compiled', async ({ page, request }) => {
	const status = await request.get('/api/v1/status');
	expect(status.ok()).toBe(true);
	const body = (await status.json()) as {
		databases: { name: string; counts: Record<string, number> }[];
	};
	expect(body.databases.find((db) => db.name === 'Fixtures')?.counts).toEqual({
		customFormats: 4,
		qualityProfiles: 3,
		regularExpressions: 3,
		delayProfiles: 3
	});

	await page.goto('/databases');
	await expect(
		page.getByRole('main').getByRole('heading', { name: 'Fixtures', exact: true })
	).toBeVisible();
});
