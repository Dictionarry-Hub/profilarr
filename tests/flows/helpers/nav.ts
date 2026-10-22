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
 * a database id. Quality Profiles › Testing is left out: like the custom
 * format Testing tab, it only shows when the parser is running, which flow
 * tests don't start.
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
			const link = sidebar(page).getByRole('link', { name, exact: true });
			await expect(link, `The sidebar should show ${name}`).toBeVisible();
			await link.click();
			await expect(page, `${name} should land on ${SIDEBAR[name]}`).toHaveURL((url) =>
				SIDEBAR[name].test(url.pathname)
			);
		},
		{ box: true }
	);
}

/** Sections whose list pages open individual entities */
const ENTITY_PAGES = {
	'Quality Profiles': /^\/quality-profiles\/\d+\/\d+\/general$/,
	'Custom Formats': /^\/custom-formats\/\d+\/\d+(\/general)?$/,
	'Regular Expressions': /^\/regular-expressions\/\d+\/\d+$/,
	'Delay Profiles': /^\/delay-profiles\/\d+\/[^/]+$/,
	'Naming Settings': /^\/media-management\/\d+\/naming\/(radarr|sonarr)\/[^/]+$/,
	'Quality Definitions': /^\/media-management\/\d+\/quality-definitions\/(radarr|sonarr)\/[^/]+$/,
	'Media Settings': /^\/media-management\/\d+\/media-settings\/(radarr|sonarr)\/[^/]+$/
} as const satisfies Partial<Record<SidebarPage, RegExp>>;

export type EntitySection = keyof typeof ENTITY_PAGES;

/**
 * Open one entity from its section's list, by the name on its card, and wait
 * until its page has loaded.
 */
export async function openEntity(page: Page, section: EntitySection, name: string): Promise<void> {
	await test.step(
		`Open ${section} › ${name}`,
		async () => {
			await openSidebarPage(page, section);
			const card = page
				.getByRole('main')
				.getByRole('link')
				.filter({ has: page.getByRole('heading', { name, exact: true }) });
			await expect(card, `${section} should list ${name}`).toBeVisible();
			await card.click();
			await expect(page, `${name} should open a ${section} page`).toHaveURL((url) =>
				ENTITY_PAGES[section].test(url.pathname)
			);
			// The URL can change before the page renders; wait for the entity itself
			await expect(
				page.getByRole('main').getByRole('textbox', { name: /^Name/ }),
				`The ${section} page should show ${name} in its Name field`
			).toHaveValue(name);
		},
		{ box: true }
	);
}

/**
 * Tabs on entity pages, like a quality profile's Scoring or a custom format's
 * Conditions. Custom format Testing only shows when the parser is running,
 * which flow tests don't start.
 */
export type EntityTab = 'General' | 'Scoring' | 'Qualities' | 'Conditions' | 'Testing';

/** Switch to a tab on the current entity page and wait until it has loaded */
export async function openTab(page: Page, tab: EntityTab): Promise<void> {
	await test.step(
		`Open the ${tab} tab`,
		async () => {
			const button = page
				.getByRole('navigation', { name: 'Tabs' })
				.getByRole('button', { name: tab });
			await expect(button, `The ${tab} tab should be shown`).toBeVisible();
			await button.click();
			const segment = `/${tab.toLowerCase()}`;
			await expect(page, `The ${tab} tab should end the URL in ${segment}`).toHaveURL((url) =>
				url.pathname.endsWith(segment)
			);
			// Each tab's page opens with a heading of the same name. Levels differ
			// between pages (Conditions uses h2), so any level counts.
			await expect(
				page.getByRole('main').getByRole('heading', { name: tab, exact: true }),
				`The ${tab} tab should show its heading`
			).toBeVisible();
		},
		{ box: true }
	);
}
