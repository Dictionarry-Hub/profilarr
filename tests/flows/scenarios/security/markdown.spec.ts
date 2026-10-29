/**
 * - Threat: a linked database's developer puts HTML with an event handler
 *   into markdown that every user who pulls the database will see.
 * - Defence: renderMarkdown() escapes raw HTML, then sanitizeHtml() strips
 *   anything left (src/lib/shared/utils/markdown.ts, sanitize.ts).
 */
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME, type App } from '#flows/helpers/core/test.ts';
import { fixture } from '#flows/helpers/core/fixtureData.ts';
import { openDatabase, openSidebarPage } from '#flows/helpers/core/nav.ts';
import { pullDatabase } from '#flows/helpers/git/databases.ts';
import { upstream } from '#flows/helpers/git/upstream.ts';

/**
 * An inline event handler with an unquoted attribute. The handler must not
 * contain `=`: an unquoted value can't, so the markdown parser would read the
 * payload as plain text and never exercise its HTML handling.
 */
const PAYLOAD = '<img src=x onerror=window.xssFired++>';
const TEXT = `Benign intro ${PAYLOAD} trailing text`;
const FORMAT = fixture.customFormat('Title Match').name;
const ANNOUNCEMENT = 'XSS Probe Announcement';

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Commit both payloads to the database's upstream, as its developer would, and pull them */
async function publishPayloads(app: App, page: Page): Promise<void> {
	await upstream(app).commit(
		{
			'ops/8.xss-probe.sql': `UPDATE custom_formats SET description = ${sqlString(TEXT)} WHERE name = ${sqlString(FORMAT)};\n`,
			'announcements/01K8XSSPR0BE00000000000000.md': [
				'---',
				`title: ${ANNOUNCEMENT}`,
				'severity: info',
				'published_at: 2026-01-01T00:00:00Z',
				'---',
				TEXT,
				''
			].join('\n')
		},
		'Publish the XSS probes'
	);
	await openDatabase(page, FIXTURES_NAME);
	await pullDatabase(page);
}

/**
 * The checks every test makes, in order:
 * 1. The text around the payload renders, so no check passes on an empty page.
 * 2. No <img onerror> reaches the page.
 * 3. The handler never runs.
 * 4. The payload shows as plain text.
 *
 * The security checks (2 and 3) come before 4, so a broken defence fails on
 * them by name.
 */
async function expectInert(page: Page, where: string): Promise<void> {
	await expect(
		page.getByRole('main').getByText('Benign intro').first(),
		`${where}: the text around the payload should render`
	).toBeVisible();
	await expect(
		page.locator('img[onerror]'),
		`${where}: no img with an onerror attribute should reach the page`
	).toHaveCount(0);
	// A broken image fails within moments; give a handler that time to fire
	await page.waitForTimeout(1000);
	expect(
		await page.evaluate(() => 'xssFired' in window),
		`${where}: the event handler should never run`
	).toBe(false);
	await expect(
		page.getByRole('main').getByText(PAYLOAD).first(),
		`${where}: the payload should show as plain text`
	).toBeVisible();
}

/** Mark the loaded document, so a later check can tell a client-side navigation from a reload */
async function markDocument(page: Page): Promise<void> {
	await page.evaluate(() => {
		(window as unknown as Record<string, unknown>).__flowsSameDocument = true;
	});
}

async function expectSameDocument(page: Page): Promise<void> {
	const same = await page.evaluate(
		() => (window as unknown as Record<string, unknown>).__flowsSameDocument === true
	);
	expect(same, 'the page should change by client-side routing, not a reload').toBe(true);
}

/** Open the announcement's row; an early click can land before hydration, so retry */
async function expandAnnouncement(page: Page): Promise<void> {
	const main = page.getByRole('main');
	await expect(main.getByText(ANNOUNCEMENT)).toBeVisible();
	await expect(async () => {
		const expand = main.getByRole('button', { name: 'Expand' });
		if (await expand.count()) await expand.first().click();
		await expect(main.getByText('Benign intro').first()).toBeVisible({ timeout: 1000 });
	}).toPass({ timeout: 10_000 });
}

test.describe('custom format descriptions', () => {
	/**
	 * Flow:
	 * 1. The developer commits a custom format description holding the payload.
	 * 2. The user pulls it on the Changes tab.
	 * 3. The user opens Custom Formats and reloads, so the server renders the
	 *    page (SSR).
	 *
	 * Expects:
	 * - the description renders
	 * - no <img onerror> reaches the page
	 * - the handler never runs
	 * - the payload shows as plain text
	 */
	test("don't run embedded HTML when server-rendered", async ({ app, page }) => {
		await publishPayloads(app, page);
		await openSidebarPage(page, 'Custom Formats');
		await page.reload();

		await expect(page.getByRole('main').getByRole('heading', { name: FORMAT })).toBeVisible();
		await expectInert(page, 'custom formats, direct load');
	});

	/**
	 * Flow:
	 * 1. The developer commits the same description, and the user pulls it.
	 * 2. The user loads Databases.
	 * 3. The user clicks Custom Formats in the sidebar, so the browser renders
	 *    the page (CSR).
	 *
	 * Expects:
	 * - the page changes without a reload
	 * - the same checks as the server-rendered test pass
	 */
	test("don't run embedded HTML when client-rendered", async ({ app, page }) => {
		await publishPayloads(app, page);
		await page.goto('/databases');
		await markDocument(page);
		await openSidebarPage(page, 'Custom Formats');

		await expectSameDocument(page);
		await expect(page.getByRole('main').getByRole('heading', { name: FORMAT })).toBeVisible();
		await expectInert(page, 'custom formats, sidebar click');
	});
});

test.describe('database announcement bodies', () => {
	/**
	 * Flow:
	 * 1. The developer commits an announcement whose body holds the payload.
	 * 2. The user pulls it on the Changes tab.
	 * 3. The user loads Announcements directly, so the server renders the page
	 *    (SSR).
	 * 4. The user expands the announcement's row.
	 *
	 * Expects:
	 * - the body renders
	 * - no <img onerror> reaches the page
	 * - the handler never runs
	 * - the payload shows as plain text
	 */
	test("don't run embedded HTML when server-rendered", async ({ app, page }) => {
		await publishPayloads(app, page);
		await page.goto('/announcements');

		await expandAnnouncement(page);
		await expectInert(page, 'announcements, direct load');
	});

	/**
	 * Flow:
	 * 1. The developer commits the same announcement, and the user pulls it.
	 * 2. The user loads Databases.
	 * 3. The user clicks Announcements in the sidebar, so the browser renders
	 *    the page (CSR).
	 * 4. The user expands the announcement's row.
	 *
	 * Expects:
	 * - the page changes without a reload
	 * - the same checks as the server-rendered test pass
	 */
	test("don't run embedded HTML when client-rendered", async ({ app, page }) => {
		await publishPayloads(app, page);
		await page.goto('/databases');
		await markDocument(page);
		await openSidebarPage(page, 'Announcements');

		await expectSameDocument(page);
		await expandAnnouncement(page);
		await expectInert(page, 'announcements, sidebar click');
	});
});
