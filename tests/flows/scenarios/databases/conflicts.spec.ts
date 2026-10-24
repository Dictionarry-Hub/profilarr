/**
 * - A user op conflicts when it can't apply on top of what upstream now has:
 *   an update whose value guard misses (`guard_mismatch`), or a create whose
 *   name upstream has since taken (`duplicate_key`).
 * - The database's conflict strategy decides what happens on pull: Override
 *   reapplies the local change, Align drops it, and Ask lists each conflict on
 *   the Conflicts tab for the user to resolve either way.
 * - Each test checks what the app stored after the pull and after each
 *   resolution, not only what the Conflicts tab shows.
 */
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME, type App } from '$flows/helpers/core/test.ts';
import { fixture } from '$flows/helpers/core/fixtureData.ts';
import { saveForm } from '$flows/helpers/core/forms.ts';
import { newEntity, openDatabase, openEntity, openSidebarPage } from '$flows/helpers/core/nav.ts';
import { regularExpressionPages } from '$flows/helpers/entities/regularExpressions.ts';
import { conflictsPage, resolveConflict } from '$flows/helpers/git/conflicts.ts';
import { pullDatabase, setConflictStrategy } from '$flows/helpers/git/databases.ts';
import { upstream } from '$flows/helpers/git/upstream.ts';

const UNUSED = fixture.regularExpression('Unused Regex');
const TITLE = fixture.regularExpression('Title Regex');
const GROUP = fixture.regularExpression('Group Regex');

/** A regex the fixtures don't have, which a local create and an upstream insert both claim */
const NEW_NAME = 'Flow Regex';

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** An upstream op that changes a regex's pattern, as its developer would publish */
function setPatternOp(name: string, pattern: string): string {
	return `UPDATE regular_expressions SET pattern = ${sqlString(pattern)} WHERE name = ${sqlString(name)};\n`;
}

/** An upstream op that adds a regex, in the form the fixtures' own ops use */
function insertRegexOp(name: string, pattern: string): string {
	return `insert into "regular_expressions" ("name", "pattern", "description", "regex101_id") values (${sqlString(name)}, ${sqlString(pattern)}, NULL, NULL);\n`;
}

/** Edit a regex's pattern and save, which writes a user op guarded on the old pattern */
async function editPattern(page: Page, name: string, pattern: string): Promise<void> {
	await openEntity(page, 'Regular Expressions', name);
	await page
		.getByRole('main')
		.getByRole('textbox', { name: /^Regular Expression/ })
		.fill(pattern);
	await saveForm(page, { button: 'Save Changes' });
}

/** Create a regex from the blank form, which writes a user op that inserts it */
async function createRegex(page: Page, name: string, pattern: string): Promise<void> {
	await newEntity(page, 'Regular Expressions', 'Blank');
	const main = page.getByRole('main');
	await main.getByRole('textbox', { name: /^Name/ }).fill(name);
	await main.getByRole('textbox', { name: /^Regular Expression/ }).fill(pattern);
	await saveForm(page, { button: 'Create' });
}

/** Commit an upstream op and pull it, as a user would from the Changes tab */
async function pullUpstreamOp(app: App, page: Page, filename: string, sql: string): Promise<void> {
	await upstream(app).commitOp(filename, sql, `Publish ${filename}`);
	await openDatabase(page, FIXTURES_NAME);
	await pullDatabase(page);
}

/** Every stored regex pattern by name, read from the list page's data */
async function storedPatterns(page: Page): Promise<Map<string, string>> {
	await openSidebarPage(page, 'Regular Expressions');
	const regexes = await regularExpressionPages.list(page);
	return new Map(regexes.map((regex) => [regex.name, regex.pattern]));
}

/** The Conflicts tab lists nothing and says so */
async function expectNoConflicts(page: Page, when: string): Promise<void> {
	expect(await conflictsPage.list(page), `${when}, the Conflicts tab should list nothing`).toEqual(
		[]
	);
	await expect(
		page.getByRole('main').getByRole('status'),
		`${when}, the Conflicts tab should say no conflicts were detected`
	).toHaveText('No conflicts detected');
}

/**
 * Flow:
 * 1. The user edits Unused Regex's pattern. The database keeps its default
 *    strategy, Override.
 * 2. The developer commits an op that sets the same pattern to something else.
 * 3. The user pulls it on the Changes tab.
 *
 * Expects:
 * - the stored pattern is the user's edit
 * - the Conflicts tab lists nothing and shows its empty state
 * - the database's strategy reads `override`
 */
test('override keeps the local edit', async ({ app, page }) => {
	const local = 'LocalUnused';
	const remote = 'UpstreamUnused';
	await editPattern(page, UNUSED.name, local);
	await pullUpstreamOp(app, page, '8.change-unused-regex.sql', setPatternOp(UNUSED.name, remote));

	const patterns = await storedPatterns(page);
	const { conflictStrategy, conflicts } = await conflictsPage.read(page);

	expect(patterns.get(UNUSED.name), 'override should keep the local pattern').toBe(local);
	expect(conflicts, 'override should leave nothing on the Conflicts tab').toEqual([]);
	await expect(
		page.getByRole('main').getByRole('status'),
		'the Conflicts tab should say no conflicts were detected'
	).toHaveText('No conflicts detected');
	expect(conflictStrategy, 'the database should still use the default strategy').toBe('override');
});

/**
 * Flow:
 * 1. The user sets the database's conflict strategy to Align.
 * 2. The user edits Unused Regex's pattern.
 * 3. The developer commits an op that sets the same pattern to something else.
 * 4. The user pulls it on the Changes tab.
 *
 * Expects:
 * - the stored pattern is upstream's
 * - the Conflicts tab lists nothing
 */
test('align drops the local edit', async ({ app, page }) => {
	const local = 'LocalUnused';
	const remote = 'UpstreamUnused';
	await setConflictStrategy(page, 'Align');
	await editPattern(page, UNUSED.name, local);
	await pullUpstreamOp(app, page, '8.change-unused-regex.sql', setPatternOp(UNUSED.name, remote));

	const patterns = await storedPatterns(page);

	expect(patterns.get(UNUSED.name), "align should store upstream's pattern").toBe(remote);
	await expectNoConflicts(page, 'after the pull');
});

/**
 * Flow:
 * 1. The user sets the database's conflict strategy to Ask every time.
 * 2. The user edits the patterns of Title Regex and Group Regex.
 * 3. The developer commits an op that sets both patterns to something else.
 * 4. The user pulls it on the Changes tab and opens the Conflicts tab.
 * 5. The user aligns the Title Regex conflict and overrides the Group Regex
 *    conflict.
 *
 * Expects:
 * - after the pull, both stored patterns are upstream's
 * - the Conflicts tab lists both edits as pending guard mismatches on the
 *   regular expression, each with one field, `pattern`, showing the fixture
 *   value, the user's value and upstream's value
 * - after aligning, Title Regex keeps upstream's pattern
 * - after overriding, Group Regex has the user's pattern
 * - the Conflicts tab lists nothing
 */
test('ask lists each conflict and resolves it either way', async ({ app, page }) => {
	const local = { title: 'LocalTitle', group: 'LocalGroup' };
	const remote = { title: 'UpstreamTitle', group: 'UpstreamGroup' };
	await setConflictStrategy(page, 'Ask every time');
	await editPattern(page, TITLE.name, local.title);
	await editPattern(page, GROUP.name, local.group);
	await pullUpstreamOp(
		app,
		page,
		'8.change-two-regexes.sql',
		setPatternOp(TITLE.name, remote.title) + setPatternOp(GROUP.name, remote.group)
	);

	const pulled = await storedPatterns(page);
	const conflicts = await conflictsPage.list(page);

	expect(pulled.get(TITLE.name), "the pull should store upstream's Title Regex pattern").toBe(
		remote.title
	);
	expect(pulled.get(GROUP.name), "the pull should store upstream's Group Regex pattern").toBe(
		remote.group
	);
	expect(
		conflicts.map((row) => row.name).sort(),
		'the Conflicts tab should list one conflict per edited regex'
	).toEqual([TITLE.name, GROUP.name].sort());

	const titleRow = conflicts.find((row) => row.name === TITLE.name);
	const groupRow = conflicts.find((row) => row.name === GROUP.name);
	expect(titleRow, 'the Title Regex conflict should be pending as a guard mismatch').toMatchObject({
		status: 'conflicted_pending',
		conflictReason: 'guard_mismatch',
		entity: 'regular_expression',
		complex: false,
		fields: [{ field: 'pattern', was: TITLE.pattern, you: local.title, upstreamNow: remote.title }]
	});
	expect(groupRow, 'the Group Regex conflict should be pending as a guard mismatch').toMatchObject({
		status: 'conflicted_pending',
		conflictReason: 'guard_mismatch',
		entity: 'regular_expression',
		complex: false,
		fields: [{ field: 'pattern', was: GROUP.pattern, you: local.group, upstreamNow: remote.group }]
	});

	await resolveConflict(page, { opId: titleRow!.opId, action: 'Align' });
	await resolveConflict(page, { opId: groupRow!.opId, action: 'Override' });

	const resolved = await storedPatterns(page);
	expect(resolved.get(TITLE.name), "aligning should keep upstream's Title Regex pattern").toBe(
		remote.title
	);
	expect(resolved.get(GROUP.name), "overriding should restore the user's Group Regex pattern").toBe(
		local.group
	);
	await expectNoConflicts(page, 'once both are resolved');
});

/**
 * Flow:
 * 1. The user sets the database's conflict strategy to Ask every time.
 * 2. The user creates a regex named Flow Regex from the blank form.
 * 3. The developer commits an op that inserts a regex with the same name and
 *    a different pattern.
 * 4. The user pulls it on the Changes tab and opens the Conflicts tab.
 * 5. The user overrides the conflict.
 *
 * Expects:
 * - the Conflicts tab lists the create as a pending duplicate key on the
 *   regular expression, named Flow Regex, as a complex change
 * - after overriding, the stored pattern is the user's
 * - the Conflicts tab lists nothing
 */
test('a duplicate name on a local create is reported as a duplicate key', async ({ app, page }) => {
	const local = 'LocalFlow';
	const remote = 'UpstreamFlow';
	await setConflictStrategy(page, 'Ask every time');
	await createRegex(page, NEW_NAME, local);
	await pullUpstreamOp(app, page, '8.add-flow-regex.sql', insertRegexOp(NEW_NAME, remote));

	const conflicts = await conflictsPage.list(page);

	expect(conflicts, 'the Conflicts tab should list the create once').toHaveLength(1);
	expect(conflicts[0], 'the create should be pending as a duplicate key').toMatchObject({
		status: 'conflicted_pending',
		conflictReason: 'duplicate_key',
		entity: 'regular_expression',
		name: NEW_NAME,
		complex: true
	});

	await resolveConflict(page, { opId: conflicts[0].opId, action: 'Override' });

	const patterns = await storedPatterns(page);
	expect(patterns.get(NEW_NAME), "overriding should store the user's pattern").toBe(local);
	await expectNoConflicts(page, 'once overridden');
});
