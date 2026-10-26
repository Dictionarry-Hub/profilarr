/**
 * - Protects: the GitHub personal access token never stays in a database
 *   clone. Git gets it as a header for each command, never in a URL, so
 *   `.git/config` never saves it.
 * - The harness rewrites only the plain fixtures URL to the local upstream,
 *   so a publish that put the token in its URL would reach GitHub and fail.
 *   The rewrite also means git sends no header to the local upstream; a real
 *   GitHub push is checked by hand.
 * - Older versions saved the token in each clone's origin URL. Newer curl
 *   strips it from there and git then fails to authenticate, so startup
 *   resets such an origin to the plain URL.
 */
import { join } from 'node:path';
import { test, expect, FIXTURES_NAME } from '$flows/helpers/core/test.ts';
import { fixture, fixturesSource } from '$flows/helpers/core/fixtureData.ts';
import { saveForm } from '$flows/helpers/core/forms.ts';
import { logEntries } from '$flows/helpers/core/logs.ts';
import { openDatabase, openEntity, openPage } from '$flows/helpers/core/nav.ts';
import {
	cloneFilesHolding,
	clonedRemote,
	fixturesRepo,
	FLOWS_TOKEN,
	publishChanges,
	setClonedOrigin,
	setDeveloperAccess
} from '$flows/helpers/git/databases.ts';
import { upstream } from '$flows/helpers/git/upstream.ts';

const REPOSITORY = fixturesSource.fixtures.repository;

/** A GitHub URL with the token in it, as older versions saved it */
function withToken(url: string): string {
	return url.replace('https://github.com', `https://${FLOWS_TOKEN}@github.com`);
}

const REGEX = fixture.regularExpression('Title Regex').name;

/** A dependency clone that isn't part of the fixtures repo, made by the test */
const DEPENDENCY = 'legacy';
const DEPENDENCY_URL = 'https://github.com/Dictionarry-Hub/legacy';

/**
 * Flow:
 * 1. The developer saves a token and a git author on Fixtures › Settings.
 * 2. They edit Title Regex's description and save.
 * 3. They publish the draft from Changes.
 *
 * Expects:
 * - the upstream has the published commit
 * - the clone's origin is still the plain repository URL
 * - no file in the clone, .git included, holds the token
 * - no log entry holds the token
 */
test('publishing never saves the token in the clone', async ({ app, page }) => {
	await setDeveloperAccess(page);
	await openEntity(page, 'Regular Expressions', REGEX);
	await page.getByRole('main').getByRole('textbox', { name: 'Description' }).fill('Published');
	await saveForm(page, { button: 'Save Changes' });
	await openDatabase(page, FIXTURES_NAME);
	await publishChanges(page, 'Describe Title Regex', { rows: [REGEX] });

	expect(upstream(app).log()[0].subject, 'The upstream should have the published commit').toBe(
		'Describe Title Regex'
	);
	const repo = fixturesRepo(app);
	expect(
		(await clonedRemote(repo)).origin,
		"The clone's origin should be the plain repository URL"
	).toBe(REPOSITORY);
	expect(
		await cloneFilesHolding(repo, FLOWS_TOKEN),
		'No file in the clone should hold the token'
	).toEqual([]);
	expect(
		JSON.stringify(await logEntries(page)),
		'No log entry should hold the token'
	).not.toContain(FLOWS_TOKEN);
});

/**
 * Flow:
 * 1. An older version left the token in the fixtures clone's origin URL, and
 *    in a dependency clone's under deps/.
 * 2. Profilarr restarts.
 *
 * Expects:
 * - the clone's origin is the stored repository URL again, and its
 *   .git/config holds no token
 * - the dependency clone's origin is its URL without the token
 * - one log line names the database, and no log entry holds the token
 */
test('startup removes a token an older version saved in a clone', async ({ app, page }) => {
	const repo = fixturesRepo(app);
	const dependency = join(repo, 'deps', DEPENDENCY);
	await setClonedOrigin(repo, withToken(REPOSITORY));
	await setClonedOrigin(dependency, withToken(DEPENDENCY_URL), { create: true });
	expect(
		(await clonedRemote(repo)).origin,
		'The clone should start with the token in its origin'
	).toBe(withToken(REPOSITORY));

	await app.restart();

	const remote = await clonedRemote(repo);
	expect(remote.origin, "The clone's origin should be the stored repository URL").toBe(REPOSITORY);
	expect(remote.config, "The clone's .git/config should hold no token").not.toContain(FLOWS_TOKEN);
	const dependencyRemote = await clonedRemote(dependency);
	expect(
		dependencyRemote.origin,
		"The dependency clone's origin should be its URL without the token"
	).toBe(DEPENDENCY_URL);
	expect(
		dependencyRemote.config,
		"The dependency clone's .git/config should hold no token"
	).not.toContain(FLOWS_TOKEN);

	await openPage(page, '/databases');
	const removed = await logEntries(page, {
		source: 'PCDManager',
		message: `Removed saved token from "${FIXTURES_NAME}"`
	});
	expect(removed, 'One log line should name the database').toHaveLength(1);
	expect(
		JSON.stringify(await logEntries(page)),
		'No log entry should hold the token'
	).not.toContain(FLOWS_TOKEN);
});
