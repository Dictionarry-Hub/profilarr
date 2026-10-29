/**
 * - Protects: a database's Settings tab, from the form through the row the
 *   app stores and the update check it schedules.
 * - Every setting survives a reload. The token is stored but never sent back
 *   to the page.
 * - Conflict Strategy only shows while the database has no token, or has
 *   Local Ops Only on.
 */
import { test, expect, FIXTURES_NAME } from '#flows/helpers/core/test.ts';
import { fixturesSource } from '#flows/helpers/core/fixtureData.ts';
import { chooseOption, fillField, saveForm } from '#flows/helpers/core/forms.ts';
import { scheduledJobs } from '#flows/helpers/core/jobs.ts';
import { openDatabase, openTab, sidebar, waitForHydration } from '#flows/helpers/core/nav.ts';
import { databasesApi, FLOWS_TOKEN } from '#flows/helpers/git/databases.ts';

const NEW_NAME = `${FIXTURES_NAME} Renamed`;
const AUTHOR_NAME = 'Flow Developer';
const AUTHOR_EMAIL = 'developer@localhost';
/** Sync Strategy "Every 6 hours", as the row stores it */
const SIX_HOURS_IN_MINUTES = 360;

/**
 * Flow:
 * 1. The user opens Fixtures › Settings.
 * 2. They change Name, set Conflict Strategy to "Align", Sync Strategy to
 *    "Every 6 hours" and Auto Pull to "Disabled", and save.
 * 3. They reload.
 * 4. They type a Personal Access Token, Git Author Name and Git Author Email.
 * 5. They set Local Ops Only to "Enabled", then Conflict Strategy to "Ask
 *    every time", and save.
 * 6. They reload again.
 *
 * Expects:
 * - after the first save, the API returns the new name, align, a 6 hour sync,
 *   no auto pull, no token and the unchanged URL
 * - after the first reload, the dropdowns show the saved choices, Repository
 *   URL is read-only, Save is disabled and the sidebar shows the new name
 * - the first update check is queued 6 hours after the save
 * - while a token is typed and Local Ops Only is off, Conflict Strategy is
 *   hidden
 * - after the second save, the API has the token, the author, local ops on
 *   and ask
 * - after the second reload, the token field is empty, the author fields keep
 *   their values, and the dropdowns show Local Ops Only on and ask
 */
test('keeps every database setting after a reload', async ({ page }) => {
	const database = (await databasesApi.list(page.request)).find((db) => db.name === FIXTURES_NAME);
	if (!database) throw new Error(`GET /api/v1/databases lists no ${FIXTURES_NAME}`);
	const { id } = database;
	const main = page.getByRole('main');

	await openDatabase(page, FIXTURES_NAME);
	await openTab(page, 'Settings');
	await fillField(main, 'Name', NEW_NAME);
	await chooseOption(main, 'Conflict Strategy', 'Align');
	await chooseOption(main, 'Sync Strategy', 'Every 6 hours');
	await chooseOption(main, 'Auto Pull', 'Disabled');
	const saved = Date.now();
	await saveForm(page, { action: 'update' });

	const first = (await databasesApi.get(page.request, id)).database;
	expect(
		{
			name: first?.name,
			conflict_strategy: first?.conflict_strategy,
			sync_strategy: first?.sync_strategy,
			auto_pull: first?.auto_pull,
			hasPat: first?.hasPat,
			repository_url: first?.repository_url
		},
		'The API should return every saved setting'
	).toEqual({
		name: NEW_NAME,
		conflict_strategy: 'align',
		sync_strategy: SIX_HOURS_IN_MINUTES,
		auto_pull: 0,
		hasPat: false,
		repository_url: fixturesSource.fixtures.repository
	});

	await page.reload();
	await waitForHydration(page);
	for (const shows of [
		'Sync Strategy: Every 6 hours',
		'Auto Pull: Disabled',
		'Conflict Strategy: Align'
	]) {
		await expect(
			main.getByRole('button', { name: shows, exact: true }),
			`The dropdown should read "${shows}" after the reload`
		).toBeVisible();
	}
	await expect(
		main.getByRole('textbox', { name: /^Repository URL/ }),
		'Repository URL should be read-only'
	).not.toBeEditable();
	await expect(
		main.getByRole('button', { name: 'Save', exact: true }),
		'Save should be disabled with nothing changed'
	).toBeDisabled();
	await expect(
		sidebar(page).getByRole('link', { name: NEW_NAME, exact: true }),
		'The sidebar should show the new name'
	).toBeVisible();

	const syncKey = `pcd.sync:${id}`;
	const firstCheck = (await scheduledJobs(page)).find((job) => job.description === syncKey);
	expect(firstCheck?.status, `${syncKey} should be queued`).toBe('queued');
	const minutesAfterSave = (new Date(firstCheck?.next_run_at ?? 0).getTime() - saved) / 60_000;
	expect(
		Math.abs(minutesAfterSave - SIX_HOURS_IN_MINUTES),
		'The first update check should be due within a minute of 6 hours after the save'
	).toBeLessThan(1);

	await main.getByLabel(/^Personal Access Token/).fill(FLOWS_TOKEN);
	await main.getByLabel(/^Git Author Name/).fill(AUTHOR_NAME);
	await main.getByLabel(/^Git Author Email/).fill(AUTHOR_EMAIL);
	await expect(
		main.getByRole('button', { name: 'Local Ops Only: Disabled', exact: true }),
		'Local Ops Only should show off once a token is typed'
	).toBeVisible();
	await expect(
		main.getByRole('button', { name: /^Conflict Strategy: / }),
		'Conflict Strategy should be hidden while a token is typed and Local Ops Only is off'
	).toHaveCount(0);
	await chooseOption(main, 'Local Ops Only', 'Enabled');
	await chooseOption(main, 'Conflict Strategy', 'Ask every time');
	await saveForm(page, { action: 'update' });

	const second = (await databasesApi.get(page.request, id)).database;
	expect(
		{
			hasPat: second?.hasPat,
			git_user_name: second?.git_user_name,
			git_user_email: second?.git_user_email,
			local_ops_enabled: second?.local_ops_enabled,
			conflict_strategy: second?.conflict_strategy
		},
		'The API should return the token, the author, local ops and ask'
	).toEqual({
		hasPat: true,
		git_user_name: AUTHOR_NAME,
		git_user_email: AUTHOR_EMAIL,
		local_ops_enabled: 1,
		conflict_strategy: 'ask'
	});

	await page.reload();
	await waitForHydration(page);
	await expect(
		main.getByLabel(/^Personal Access Token/),
		'The token field should be empty after the reload'
	).toHaveValue('');
	await expect(
		main.getByLabel(/^Git Author Name/),
		'Git Author Name should keep its value'
	).toHaveValue(AUTHOR_NAME);
	await expect(
		main.getByLabel(/^Git Author Email/),
		'Git Author Email should keep its value'
	).toHaveValue(AUTHOR_EMAIL);
	for (const shows of ['Local Ops Only: Enabled', 'Conflict Strategy: Ask every time']) {
		await expect(
			main.getByRole('button', { name: shows, exact: true }),
			`The dropdown should read "${shows}" after the reload`
		).toBeVisible();
	}
});
