import { test } from '$flows/helpers/fixtures.ts';
import { openDatabase, openTab } from '$flows/helpers/nav.ts';

test('openDatabase opens Fixtures', async ({ page }) => {
	await openDatabase(page, 'Fixtures');
});

// Announcements and Config need a personal access token; Tweaks is behind a feature flag
test('openTab walks every tab of the Fixtures database', async ({ page }) => {
	await openDatabase(page, 'Fixtures');
	for (const tab of ['Updates', 'Conflicts', 'Settings', 'Changes'] as const) {
		await openTab(page, tab);
	}
});
