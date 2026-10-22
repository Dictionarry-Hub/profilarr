import { test } from '$flows/helpers/fixtures.ts';
import { SIDEBAR_PAGES, openSidebarPage } from '$flows/helpers/nav.ts';

// One test per sidebar link, so a broken page fails on its own line.
for (const name of SIDEBAR_PAGES) {
	test(`the sidebar opens ${name}`, async ({ page }) => {
		await openSidebarPage(page, name);
	});
}
