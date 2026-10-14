/**
 * E2E tests: untrusted markdown must not execute in the browser.
 *
 * The runner seeds a custom format description and a database announcement
 * body that both carry `<img src=x onerror=window.xssFired++>`. The
 * attribute is unquoted, which the sanitizer's quoted-only regexes miss.
 * If the handler runs, `xssFired` appears on `window`.
 *
 * Each page is checked twice: once loaded directly (server-rendered, then
 * hydrated) and once reached by clicking a sidebar link from another page
 * (client-side routing, so marked and the sanitizer run in the browser).
 *
 * Tests:
 * 1. Custom formats, direct load
 * 2. Custom formats, client-side navigation
 * 3. Announcements, direct load, row expanded
 * 4. Announcements, client-side navigation, row expanded
 */
import { test, expect, type Page } from '@playwright/test';

const BASE_URL = process.env.SANITIZE_URL || 'http://localhost:8002';
const DB_ID = process.env.SANITIZE_DB_ID || '1';
const CF_NAME = process.env.SANITIZE_CF_NAME || 'XSS Probe Format';
const ANNOUNCEMENT_TITLE = process.env.SANITIZE_ANNOUNCEMENT_TITLE || 'XSS Probe Announcement';

/** Text that sits next to the payload in every seeded description. */
const BENIGN_TEXT = 'Benign intro';

async function assertNothingExecuted(page: Page, label: string) {
	// Let the browser attempt the image load so any error handler would have run.
	await page.waitForTimeout(1000);
	const fired = await page.evaluate(() => 'xssFired' in window);
	expect(fired, `${label}: inline event handler executed`).toBe(false);
	await expect(
		page.locator('img[onerror]'),
		`${label}: an img with an onerror attribute reached the DOM`
	).toHaveCount(0);
}

/** Mark the current document so a later check can tell a client-side navigation from a full reload. */
async function markDocument(page: Page) {
	await page.evaluate(() => {
		(window as unknown as Record<string, unknown>).__sameDocument = true;
	});
}

async function assertSameDocument(page: Page) {
	const same = await page.evaluate(
		() => (window as unknown as Record<string, unknown>).__sameDocument === true
	);
	expect(same, 'navigation was a full page load, not client-side routing').toBe(true);
}

// Locators below were recorded with Playwright codegen against the seeded server.

async function openCustomFormatsFromSidebar(page: Page) {
	await page.getByText('🎨 Custom Formats').click();
}

async function openAnnouncementsFromSidebar(page: Page) {
	await page.getByRole('link', { name: 'Announcements 1' }).click();
}

async function expandAnnouncement(page: Page) {
	await page.getByRole('button', { name: 'Expand', description: 'Expand' }).click();
	await expect(page.getByText(BENIGN_TEXT).first()).toBeVisible();
}

test.describe('Custom format descriptions', () => {
	test('direct load does not execute the handler', async ({ page }) => {
		await page.goto(`${BASE_URL}/custom-formats/${DB_ID}`);
		await expect(page.getByRole('heading', { name: CF_NAME })).toBeVisible();
		await assertNothingExecuted(page, 'custom formats, direct load');
	});

	test('client-side navigation does not execute the handler', async ({ page }) => {
		await page.goto(`${BASE_URL}/databases`);
		await markDocument(page);
		await openCustomFormatsFromSidebar(page);
		await page.waitForURL(new RegExp(`/custom-formats/${DB_ID}$`));
		await assertSameDocument(page);
		await expect(page.getByRole('heading', { name: CF_NAME })).toBeVisible();
		await assertNothingExecuted(page, 'custom formats, client-side navigation');
	});
});

test.describe('Announcement bodies', () => {
	test('direct load does not execute the handler', async ({ page }) => {
		await page.goto(`${BASE_URL}/announcements`);
		await expandAnnouncement(page);
		await assertNothingExecuted(page, 'announcements, direct load');
	});

	test('client-side navigation does not execute the handler', async ({ page }) => {
		await page.goto(`${BASE_URL}/databases`);
		await markDocument(page);
		await openAnnouncementsFromSidebar(page);
		await page.waitForURL(/\/announcements$/);
		await assertSameDocument(page);
		await expandAnnouncement(page);
		await assertNothingExecuted(page, 'announcements, client-side navigation');
	});
});
