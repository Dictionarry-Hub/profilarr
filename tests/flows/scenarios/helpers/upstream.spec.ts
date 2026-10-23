import { test, expect, FIXTURES_NAME } from '$flows/helpers/test.ts';
import { openDatabase, openTab } from '$flows/helpers/nav.ts';
import { upstream } from '$flows/helpers/upstream.ts';

test('the upstream starts with the fixtures commit', async ({ app }) => {
	const origin = upstream(app);

	expect(origin.log().map((commit) => commit.subject)).toEqual(['fixtures']);
	expect(origin.files('ops').length, 'the upstream has the fixtures ops').toBeGreaterThan(0);
	expect(JSON.parse(origin.show('pcd.json')).name).toBe('fixtures');
});

test('commit adds, changes and deletes files upstream', async ({ app }) => {
	const origin = upstream(app);

	const hash = await origin.commit({ 'notes/a.md': 'first', 'README.md': null }, 'Add a note');
	await origin.commitOp('99.probe.sql', 'SELECT 1;\n', 'Add a probe op');

	const log = origin.log();
	expect(log.map((commit) => commit.subject).slice(0, 2)).toEqual(['Add a probe op', 'Add a note']);
	expect(log[1].hash).toBe(hash);
	expect(origin.show('notes/a.md')).toBe('first');
	expect(origin.files('ops')).toContain('99.probe.sql');
	expect(origin.files(''), 'the deleted file is gone').not.toContain('README.md');
});

test('the app sees an upstream commit on its Updates tab', async ({ app, page }) => {
	await upstream(app).commit({ 'notes/a.md': 'first' }, 'Add a note upstream');

	await openDatabase(page, FIXTURES_NAME);
	await openTab(page, 'Updates');

	await expect(page.getByRole('main').getByText('Add a note upstream')).toBeVisible();
});
