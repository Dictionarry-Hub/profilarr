/**
 * Navigation helpers. They click through the UI the way a user would, then
 * check where they landed, so a wrong click fails at the click.
 *
 * Each helper runs as one named test.step, so UI mode and traces show it as a
 * single collapsible action. `box: true` makes a failure point at the line in
 * the scenario that called the helper, not inside the helper.
 */

import { expect, test, type Page } from '@playwright/test';

/**
 * Every fixed sidebar link, keyed by its label, with the path it should land
 * on. Section pages redirect to the last-used database, so their paths allow
 * a database id.
 */
const SIDEBAR = {
	Announcements: /^\/announcements$/,
	Databases: /^\/databases$/,
	Arrs: /^\/arr$/,
	'Quality Profiles': /^\/quality-profiles\/\d+$/,
	'Custom Formats': /^\/custom-formats\/\d+$/,
	'Regular Expressions': /^\/regular-expressions\/\d+$/,
	'Media Management': /^\/media-management\/\d+\/[a-z-]+$/,
	'Naming Settings': /^\/media-management\/\d+\/naming$/,
	'Quality Definitions': /^\/media-management\/\d+\/quality-definitions$/,
	'Media Settings': /^\/media-management\/\d+\/media-settings$/,
	'Delay Profiles': /^\/delay-profiles\/\d+$/,
	Settings: /^\/settings(\/[a-z-]+)?$/,
	General: /^\/settings\/general$/,
	Jobs: /^\/settings\/jobs$/,
	Logs: /^\/settings\/logs$/,
	Backups: /^\/settings\/backups$/,
	Notifications: /^\/settings\/notifications$/,
	Security: /^\/settings\/security$/,
	About: /^\/settings\/about$/
} as const satisfies Record<string, RegExp>;

export type SidebarPage = keyof typeof SIDEBAR;
export const SIDEBAR_PAGES = Object.keys(SIDEBAR) as SidebarPage[];

/** The sidebar, as opposed to the top bar's copies of the same links */
export function sidebar(page: Page) {
	return page.getByRole('navigation', { name: 'Sidebar' });
}

/**
 * Click a sidebar link and wait until the page it leads to has loaded.
 * Opens the app first if the page hasn't loaded anything yet.
 */
export async function openSidebarPage(page: Page, name: SidebarPage): Promise<void> {
	await test.step(
		`Open ${name} from the sidebar`,
		async () => {
			if (page.url() === 'about:blank') await page.goto('/');
			await sidebar(page).getByRole('link', { name, exact: true }).click();
			await expect(page, `${name} should land on ${SIDEBAR[name]}`).toHaveURL((url) =>
				SIDEBAR[name].test(url.pathname)
			);
		},
		{ box: true }
	);
}
