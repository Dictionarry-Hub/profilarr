/**
 * - Protects: linking a database from GitHub, the first thing a new install
 *   does. The clone, the base op import and the compile all run against the
 *   real fixtures repository.
 * - Relinking starts over from upstream: a new row with the link form's
 *   defaults and a new clone, with no local edit or old setting carried over.
 * - Unlinking removes the row, the clone and the database's scheduled sync,
 *   and every section page falls back to "No Databases Linked".
 * - Reaches the internet, so it carries the `@online` tag and is skipped
 *   unless the run has network (`deno task test:flows --online`).
 * - The app runs without the harness's URL rewrite, so git reaches GitHub
 *   instead of the test's local upstream.
 */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { test, expect, FIXTURES_NAME } from '#flows/helpers/core/test.ts';
import { fixture, fixtures, fixturesSource } from '#flows/helpers/core/fixtureData.ts';
import { saveForm } from '#flows/helpers/core/forms.ts';
import { scheduledJobs } from '#flows/helpers/core/jobs.ts';
import { openEntity, openPage, sidebar } from '#flows/helpers/core/nav.ts';
import { ONLINE_TAG, skipWithoutNetwork } from '#flows/helpers/core/realServices.ts';
import { regularExpressionPages } from '#flows/helpers/entities/regularExpressions.ts';
import {
	databaseFolders,
	databasesApi,
	fixturesRepo,
	linkDatabase,
	unlinkDatabase
} from '#flows/helpers/git/databases.ts';

const REPOSITORY = fixturesSource.fixtures.repository;
const UNUSED = fixture.regularExpression('Unused Regex');
const EDITED_PATTERN = `${UNUSED.pattern}-edited`;

/** What the Link Database form saves when its settings are left alone */
const LINK_DEFAULTS = { sync_strategy: 60, auto_pull: 1, conflict_strategy: 'override' };

/** Section pages that need a linked database, opened by URL */
const SECTION_PAGES = [
	'/quality-profiles',
	'/custom-formats',
	'/regular-expressions',
	'/delay-profiles',
	'/media-management'
];

// Every app's GIT_CONFIG_GLOBAL points at a gitconfig that rewrites the
// fixtures GitHub URL to a local bare repo (harness/seed.ts). An empty config
// turns that off, so this app's git reaches GitHub.
test.use({ appEnv: { GIT_CONFIG_GLOBAL: '/dev/null' } });

interface StatusBody {
	databases: { id: number; name: string; counts: Record<string, number> }[];
}

/**
 * Flow:
 * 1. The user edits Unused Regex's pattern: Regular Expressions › Unused
 *    Regex, change the Regular Expression textbox, click Save Changes.
 * 2. The user unlinks Fixtures from the Databases page.
 * 3. The user links the fixtures GitHub URL under the same name.
 * 4. The user opens the new database's quality profiles.
 * 5. The user unlinks it from its Settings tab.
 * 6. The user opens Quality Profiles, Custom Formats, Regular Expressions,
 *    Delay Profiles and Media Management by URL.
 *
 * Expects:
 * - after the first unlink, the seeded clone's folder is gone
 * - the relinked row has a new id and uuid, keeps the GitHub URL, is enabled
 *   and has the link form's defaults, not the old row's settings
 * - the data folder holds only the new clone, and its schema dependency has
 *   the pinned version
 * - the compiled counts match the fixtures snapshot
 * - Unused Regex has its upstream pattern again, without the local edit
 * - the first update check is queued an hour after the link
 * - the quality profiles page lists a fixture profile
 * - after the second unlink, the API lists no database and answers 404 for
 *   its id, the status lists none, the data folder is empty, the scheduled
 *   check is gone, and the Databases page and the sidebar show no database
 * - every section page shows "No Databases Linked", and the old database's
 *   quality profiles page answers 404
 */
test(
	'relinks a database from GitHub in its upstream state, and unlinks it completely',
	{ tag: ONLINE_TAG },
	async ({ app, page, request }) => {
		skipWithoutNetwork();

		await openEntity(page, 'Regular Expressions', UNUSED.name);
		await page
			.getByRole('main')
			.getByRole('textbox', { name: /^Regular Expression/ })
			.fill(EDITED_PATTERN);
		await saveForm(page, { button: 'Save Changes' });
		const seeded = (await databasesApi.list(request)).find((db) => db.name === FIXTURES_NAME);
		if (!seeded) throw new Error(`GET /api/v1/databases lists no ${FIXTURES_NAME}`);
		const edited = (
			await regularExpressionPages.list(page, `/regular-expressions/${seeded.id}`)
		).find((regex) => regex.name === UNUSED.name);
		expect(edited?.pattern, 'The local edit should be stored before the unlink').toBe(
			EDITED_PATTERN
		);
		expect(
			{ sync_strategy: seeded.sync_strategy, auto_pull: seeded.auto_pull },
			'The seeded row should start with manual sync and no auto pull'
		).toEqual({ sync_strategy: 0, auto_pull: 0 });

		await unlinkDatabase(page, { from: 'cards' });
		expect(
			existsSync(fixturesRepo(app)),
			"The seeded clone's folder should be gone after the unlink"
		).toBe(false);

		const linkedAt = Date.now();
		await linkDatabase(page, { name: FIXTURES_NAME, url: REPOSITORY });

		const relinked = (await databasesApi.list(request)).find((db) => db.name === FIXTURES_NAME);
		if (!relinked) throw new Error(`GET /api/v1/databases lists no relinked ${FIXTURES_NAME}`);
		expect(relinked.id, 'The relinked database should get a new id').not.toBe(seeded.id);
		expect(relinked.uuid, 'The relinked database should get a new uuid').not.toBe(
			basename(fixturesRepo(app))
		);
		expect(relinked.repository_url, 'The row should keep the GitHub URL').toBe(REPOSITORY);
		expect(relinked.enabled, 'The database should be enabled').toBe(1);
		expect(
			{
				sync_strategy: relinked.sync_strategy,
				auto_pull: relinked.auto_pull,
				conflict_strategy: relinked.conflict_strategy
			},
			"The row should have the link form's defaults, with no old setting carried over"
		).toEqual(LINK_DEFAULTS);

		expect(await databaseFolders(app), 'The data folder should hold only the new clone').toEqual([
			relinked.uuid
		]);
		const schemaManifest = JSON.parse(
			await readFile(join(app.dir, 'data/databases', relinked.uuid, 'deps/schema/pcd.json'), 'utf8')
		) as { version: string };
		expect(schemaManifest.version, 'The schema dependency should have the pinned version').toBe(
			fixturesSource.schema.version
		);

		const status = await request.get('/api/v1/status');
		expect(status.ok(), 'GET /api/v1/status should answer').toBe(true);
		expect(
			((await status.json()) as StatusBody).databases.find((db) => db.id === relinked.id)?.counts,
			'The clone should compile to the counts in the fixtures snapshot'
		).toEqual({
			customFormats: fixtures.customFormats.length,
			qualityProfiles: fixtures.qualityProfiles.length,
			regularExpressions: fixtures.regularExpressions.length,
			delayProfiles: fixtures.delayProfiles.length
		});

		const upstreamRegex = (
			await regularExpressionPages.list(page, `/regular-expressions/${relinked.id}`)
		).find((regex) => regex.name === UNUSED.name);
		expect(upstreamRegex?.pattern, 'Unused Regex should have its upstream pattern again').toBe(
			UNUSED.pattern
		);

		const syncKey = `pcd.sync:${relinked.id}`;
		const firstCheck = (await scheduledJobs(page)).find((job) => job.description === syncKey);
		expect(firstCheck?.status, `${syncKey} should be queued`).toBe('queued');
		const minutesAfterLink = (new Date(firstCheck?.next_run_at ?? 0).getTime() - linkedAt) / 60_000;
		expect(
			Math.abs(minutesAfterLink - LINK_DEFAULTS.sync_strategy),
			'The first update check should be due within a minute of an hour after the link'
		).toBeLessThan(1);

		const profile = fixture.qualityProfile('Radarr Profile').name;
		await openPage(page, `/quality-profiles/${relinked.id}`);
		await expect(
			page.getByRole('main').getByRole('heading', { name: profile, exact: true }),
			`The new database's quality profiles should list ${profile}`
		).toBeVisible();

		await unlinkDatabase(page, { from: 'settings' });
		expect(await databasesApi.list(request), 'The API should list no database').toEqual([]);
		expect(
			(await databasesApi.get(request, relinked.id)).response.status(),
			`GET /api/v1/databases/${relinked.id} should answer 404`
		).toBe(404);
		const emptyStatus = await request.get('/api/v1/status');
		expect(emptyStatus.ok(), 'GET /api/v1/status should answer').toBe(true);
		expect(
			((await emptyStatus.json()) as StatusBody).databases,
			'The status should list no database'
		).toEqual([]);
		expect(await databaseFolders(app), 'The data folder should be empty').toEqual([]);
		expect(
			(await scheduledJobs(page)).map((job) => job.description),
			`${syncKey} should no longer be scheduled`
		).not.toContain(syncKey);
		await expect(
			page.getByRole('main').getByRole('heading', { name: 'No Databases Linked', exact: true }),
			'The Databases page should show that no database is linked'
		).toBeVisible();
		await expect(
			sidebar(page).getByRole('link', { name: FIXTURES_NAME, exact: true }),
			`The sidebar should not list ${FIXTURES_NAME}`
		).toHaveCount(0);

		for (const path of SECTION_PAGES) {
			await openPage(page, path);
			await expect(
				page.getByRole('main').getByRole('heading', { name: 'No Databases Linked', exact: true }),
				`${path} should show that no database is linked`
			).toBeVisible();
		}
		expect(
			(await request.get(`/quality-profiles/${relinked.id}`)).status(),
			`/quality-profiles/${relinked.id} should answer 404`
		).toBe(404);
	}
);
