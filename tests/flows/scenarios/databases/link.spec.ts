/**
 * - Protects: linking a database from GitHub, the first thing a new install
 *   does. The clone, the base op import and the compile all run against the
 *   real fixtures repository.
 * - Reaches the internet, so it carries the `@online` tag and is skipped
 *   unless the run has network (`deno task flows --online`).
 * - The app runs without the harness's URL rewrite, so git reaches GitHub
 *   instead of the test's local upstream.
 */
import { test, expect } from '$flows/helpers/core/test.ts';
import { fixture, fixtures, fixturesSource } from '$flows/helpers/core/fixtureData.ts';
import { openPage } from '$flows/helpers/core/nav.ts';
import { ONLINE_TAG, skipWithoutNetwork } from '$flows/helpers/core/realServices.ts';
import { linkDatabase } from '$flows/helpers/git/databases.ts';

const NAME = 'Fixtures from GitHub';
const REPOSITORY = fixturesSource.fixtures.repository;

// Every app's GIT_CONFIG_GLOBAL points at a gitconfig that rewrites the
// fixtures GitHub URL to a local bare repo (harness/seed.ts). An empty config
// turns that off, so this app's git reaches GitHub.
test.use({ appEnv: { GIT_CONFIG_GLOBAL: '/dev/null' } });

interface DatabaseRow {
	id: number;
	name: string;
	repository_url: string;
	enabled: number;
}

/**
 * Flow:
 * 1. The user opens Databases › Link Database.
 * 2. They enter a name and the fixtures repository's GitHub URL, and save.
 * 3. The link job clones the repository, imports its ops and compiles them.
 * 4. The user opens the new database's quality profiles.
 *
 * Expects:
 * - the Databases page lists the new database once the job finishes
 * - the stored row keeps the GitHub URL and is enabled
 * - the compiled counts match the fixtures snapshot
 * - the quality profiles page lists a fixture profile
 */
test('links a database from GitHub', { tag: ONLINE_TAG }, async ({ page, request }) => {
	skipWithoutNetwork();
	await linkDatabase(page, { name: NAME, url: REPOSITORY });

	const list = await request.get('/api/v1/databases');
	expect(list.ok()).toBe(true);
	const row = ((await list.json()) as DatabaseRow[]).find((db) => db.name === NAME);
	expect(row, 'The API should list the linked database').toBeDefined();
	expect(row?.repository_url, 'The row should keep the GitHub URL').toBe(REPOSITORY);
	expect(row?.enabled, 'The database should be enabled').toBe(1);

	const status = await request.get('/api/v1/status');
	expect(status.ok()).toBe(true);
	const body = (await status.json()) as {
		databases: { name: string; counts: Record<string, number> }[];
	};
	expect(
		body.databases.find((db) => db.name === NAME)?.counts,
		'The clone should compile to the counts in the fixtures snapshot'
	).toEqual({
		customFormats: fixtures.customFormats.length,
		qualityProfiles: fixtures.qualityProfiles.length,
		regularExpressions: fixtures.regularExpressions.length,
		delayProfiles: fixtures.delayProfiles.length
	});

	const profile = fixture.qualityProfile('Radarr Profile').name;
	await openPage(page, `/quality-profiles/${row?.id}`);
	await expect(
		page.getByRole('main').getByRole('heading', { name: profile, exact: true }),
		`The new database's quality profiles should list ${profile}`
	).toBeVisible();
});
