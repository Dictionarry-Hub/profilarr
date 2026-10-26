/**
 * - Protects: a pull really syncing the Arr. Every section is on On Pull, so
 *   each pull queues an `arr.sync.<section>` job for it, and the user's own
 *   edits stay on top of what upstream sends.
 * - Protects: a pending conflict, under the Ask strategy, surviving a
 *   restart, and resolving it reaching the Arr through drift and a sync.
 * - While a conflict waits, Profilarr syncs what it holds, which is
 *   upstream's value. That is intended.
 * - One user, Sonarr 5, the built-in fixtures database, login off.
 */
import type { Page } from '@playwright/test';
import { test, expect, FIXTURES_NAME, type App } from '$flows/helpers/core/test.ts';
import { fixture } from '$flows/helpers/core/fixtureData.ts';
import { saveForm } from '$flows/helpers/core/forms.ts';
import {
	latestJobRunId,
	scheduledJobs,
	waitForIdleJobs,
	waitForNextJobRun
} from '$flows/helpers/core/jobs.ts';
import {
	openDatabase,
	openEntity,
	openPage,
	openSidebarPage,
	openTab
} from '$flows/helpers/core/nav.ts';
import { regularExpressionPages } from '$flows/helpers/entities/regularExpressions.ts';
import { conflictsPage, resolveConflict } from '$flows/helpers/git/conflicts.ts';
import { pullDatabase, setConflictStrategy } from '$flows/helpers/git/databases.ts';
import { upstream } from '$flows/helpers/git/upstream.ts';
import { arrInstance, openArr } from '$flows/helpers/sync/arrs.ts';
import { driftState, enableDrift, runDriftCheck } from '$flows/helpers/sync/drift.ts';
import { expectedDelayProfile } from '$flows/helpers/sync/expected.ts';
import type { FakeArr } from '$flows/helpers/sync/fakeArr.ts';
import {
	addArrAndOpenSync,
	arrSyncStatus,
	chooseDelayProfile,
	chooseMediaManagement,
	chooseQualityProfiles,
	setTrigger,
	syncConfig,
	SYNC_SECTIONS,
	syncSection,
	type SyncSection
} from '$flows/helpers/sync/sync.ts';

const INSTANCE = 'Home Sonarr';
const PROFILE = fixture.qualityProfile('Sonarr Profile');
const DELAY_PROFILE = fixture.delayProfile('Bypass Score');
const TITLE = fixture.regularExpression('Title Regex');
/** The formats the profile syncs whose Title condition uses Title Regex */
const FORMATS = [fixture.customFormat('Title Match'), fixture.customFormat('Every Condition')];
const TITLE_CONDITION = 'Title';

const LOCAL = 'LocalTitle';
const UPSTREAM = 'UpstreamTitle';
const PULLED_USENET_DELAY = (DELAY_PROFILE.usenetDelay ?? 0) + 15;

const SECTIONS: SyncSection[] = ['Media Management', 'Delay Profiles', 'Quality Profiles'];

const sqlString = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Edit a regex's pattern and save, which writes a user op guarded on the old pattern */
async function editPattern(page: Page, name: string, pattern: string): Promise<void> {
	await openEntity(page, 'Regular Expressions', name);
	await page
		.getByRole('main')
		.getByRole('textbox', { name: /^Regular Expression/ })
		.fill(pattern);
	await saveForm(page, { button: 'Save Changes' });
}

/** The stored Title Regex pattern, read from the list page's data */
async function storedPattern(page: Page): Promise<string | undefined> {
	await openSidebarPage(page, 'Regular Expressions');
	const regexes = await regularExpressionPages.list(page);
	return regexes.find((regex) => regex.name === TITLE.name)?.pattern;
}

/** The pattern each synced format's Title condition holds in Sonarr, by format name */
function heldPatterns(fake: FakeArr): Record<string, unknown> {
	return Object.fromEntries(
		FORMATS.map(({ name }) => {
			const format = fake.collection('customformat').find((cf) => cf.name === name);
			const specs = (format?.specifications ?? []) as {
				name: string;
				fields: { name: string; value: unknown }[];
			}[];
			const title = specs.find((spec) => spec.name === TITLE_CONDITION);
			return [name, title?.fields.find((field) => field.name === 'value')?.value];
		})
	);
}

/** Every format carrying `pattern`, in the shape `heldPatterns` returns */
const carrying = (pattern: string) =>
	Object.fromEntries(FORMATS.map(({ name }) => [name, pattern]));

/** Requests that change something in Sonarr, from the `from`-th on */
function writesSince(fake: FakeArr, from: number): string[] {
	return fake.requests
		.slice(from)
		.filter((request) => request.method !== 'GET')
		.map((request) => `${request.method} ${request.path}`);
}

/** The newest run of each section's sync job */
async function latestSyncRuns(page: Page): Promise<Record<SyncSection, number>> {
	const ids = {} as Record<SyncSection, number>;
	for (const section of SECTIONS) {
		ids[section] = await latestJobRunId(page, `arr.sync.${SYNC_SECTIONS[section].key}`);
	}
	return ids;
}

/**
 * Commit an upstream op, pull it on the Changes tab, and wait for the On Pull
 * sync of each section after `before`
 */
async function pullAndSync(
	app: App,
	page: Page,
	op: { filename: string; sql: string }
): Promise<void> {
	const before = await latestSyncRuns(page);
	await upstream(app).commitOp(op.filename, op.sql, `Publish ${op.filename}`);
	await openDatabase(page, FIXTURES_NAME);
	await pullDatabase(page);
	for (const section of SECTIONS) {
		const run = await waitForNextJobRun(page, `arr.sync.${SYNC_SECTIONS[section].key}`, {
			afterId: before[section]
		});
		expect(run.status, `The On Pull ${section} sync should succeed`).toBe('success');
	}
}

/**
 * Flow:
 * 1. The user sets the conflict strategy to Ask every time, connects Sonarr,
 *    sets every section's trigger to On Pull with Media Management, the
 *    Bypass Score delay profile and Sonarr Profile chosen, and syncs each.
 * 2. The user turns on drift detection and runs a check.
 * 3. The user edits Title Regex and syncs Quality Profiles.
 * 4. Upstream raises Bypass Score's usenet delay. The user pulls.
 * 5. Upstream changes Title Regex too. The user pulls.
 * 6. Profilarr restarts with the conflict pending.
 * 7. The user overrides the conflict, keeping their edit.
 * 8. The user runs a drift check.
 * 9. The user syncs Quality Profiles.
 *
 * Expects:
 * - each pull syncs every section, and the user's regex edit stays on top
 *   of a clean pull
 * - a conflicting pull lists one pending conflict, and Sonarr gets
 *   upstream's value while it waits
 * - the conflict, sync settings and drift setting survive the restart, and
 *   Sonarr gets no writes from it
 * - resolving changes Profilarr only, drift finds Sonarr behind, and a sync
 *   sends the kept edit to Sonarr
 */
test('a Sonarr user follows pulls and settles a conflict', async ({ app, page, startArr }) => {
	test.setTimeout(120_000);
	const fake = await startArr('sonarr-5');
	let id = 0;
	let opId = 0;

	await test.step('1. Set up to follow pulls', async () => {
		await setConflictStrategy(page, 'Ask every time');
		await addArrAndOpenSync(page, fake, INSTANCE);
		id = (await arrInstance(page, INSTANCE)).id;
		await setTrigger(page, 'Media Management', 'On Pull');
		await chooseMediaManagement(page, fake);
		await setTrigger(page, 'Delay Profiles', 'On Pull');
		await chooseDelayProfile(page, DELAY_PROFILE.name);
		await setTrigger(page, 'Quality Profiles', 'On Pull');
		await chooseQualityProfiles(page, fake, [PROFILE.name]);
		for (const section of SECTIONS) {
			expect((await syncSection(page, section)).status, `${section} should sync`).toBe('idle');
		}

		const { syncData } = await syncConfig(page, id);
		expect(
			[
				syncData.mediaManagement.trigger,
				syncData.delayProfiles.trigger,
				syncData.qualityProfiles.config.trigger
			],
			'Every trigger should be On Pull'
		).toEqual(['on_pull', 'on_pull', 'on_pull']);
		expect(
			(await scheduledJobs(page))
				.filter((job) => job.name.startsWith('arr.sync') && job.description.endsWith(`:${id}`))
				.map((job) => job.description),
			'No sync job should be scheduled'
		).toEqual([]);
		expect(heldPatterns(fake), "Sonarr's formats should carry the fixture's Title Regex").toEqual(
			carrying(TITLE.pattern)
		);
	});

	await test.step('2. Turn on drift', async () => {
		await enableDrift(page);
		await runDriftCheck(page);
		expect((await driftState(page, id)).status, 'Drift should be clean').toBe('clean');
	});

	await test.step('3. Tweak the title regex and sync', async () => {
		await editPattern(page, TITLE.name, LOCAL);
		await openArr(page, INSTANCE);
		await openTab(page, 'Sync');
		const lastDrift = await latestJobRunId(page, 'arr.drift');
		expect((await syncSection(page, 'Quality Profiles')).status, 'The sync should succeed').toBe(
			'idle'
		);
		expect(heldPatterns(fake), 'Both formats in Sonarr should carry the edit').toEqual(
			carrying(LOCAL)
		);
		await waitForNextJobRun(page, 'arr.drift', { afterId: lastDrift });
		expect((await driftState(page, id)).status, 'Drift should be clean').toBe('clean');
	});

	await test.step('4. A clean pull', async () => {
		await pullAndSync(app, page, {
			filename: '8.slower-bypass.sql',
			sql: `UPDATE delay_profiles SET usenet_delay = ${PULLED_USENET_DELAY} WHERE name = ${sqlString(DELAY_PROFILE.name)};\n`
		});
		expect(
			fake.collection('delayprofile').find((item) => item.id === 1),
			"Sonarr's delay profile should get the pulled usenet delay"
		).toEqual({ ...expectedDelayProfile(DELAY_PROFILE), usenetDelay: PULLED_USENET_DELAY });
		expect(heldPatterns(fake), 'The formats should still carry the edit').toEqual(carrying(LOCAL));
		expect(await conflictsPage.list(page), 'A clean pull should leave no conflict').toEqual([]);
	});

	await test.step('5. A conflicting pull', async () => {
		await pullAndSync(app, page, {
			filename: '9.upstream-title.sql',
			sql: `UPDATE regular_expressions SET pattern = ${sqlString(UPSTREAM)} WHERE name = ${sqlString(TITLE.name)};\n`
		});
		const conflicts = await conflictsPage.list(page);
		expect(conflicts, 'The pull should leave one pending conflict on Title Regex').toEqual([
			expect.objectContaining({
				status: 'conflicted_pending',
				conflictReason: 'guard_mismatch',
				entity: 'regular_expression',
				name: TITLE.name,
				fields: [{ field: 'pattern', was: TITLE.pattern, you: LOCAL, upstreamNow: UPSTREAM }]
			})
		]);
		opId = conflicts[0].opId;
		expect(heldPatterns(fake), "Sonarr should carry upstream's value while it waits").toEqual(
			carrying(UPSTREAM)
		);
	});

	await test.step('6. Restart with the conflict pending', async () => {
		await waitForIdleJobs(page);
		const before = {
			syncData: (await syncConfig(page, id)).syncData,
			status: await arrSyncStatus(page, id)
		};
		const from = fake.requests.length;

		await app.restart();
		await openPage(page, '/');

		expect(
			(await conflictsPage.list(page)).map((row) => ({ opId: row.opId, status: row.status })),
			'The same op should still be pending'
		).toEqual([{ opId, status: 'conflicted_pending' }]);
		expect(
			{ syncData: (await syncConfig(page, id)).syncData, status: await arrSyncStatus(page, id) },
			'Sync settings and status should survive the restart'
		).toEqual(before);
		expect((await driftState(page, id)).enabled, 'Drift should still be on').toBe(true);
		expect(writesSince(fake, from), 'The restart should write nothing to Sonarr').toEqual([]);
	});

	await test.step('7. Keep my edit', async () => {
		await conflictsPage.read(page);
		await resolveConflict(page, { opId, action: 'Override' });
		expect(await conflictsPage.list(page), 'Conflicts should be empty').toEqual([]);
		expect(await storedPattern(page), 'Profilarr should hold the edit').toBe(LOCAL);
		expect(heldPatterns(fake), "Sonarr should still carry upstream's value").toEqual(
			carrying(UPSTREAM)
		);
	});

	await test.step('8. Drift shows it', async () => {
		await openArr(page, INSTANCE);
		await runDriftCheck(page);
		const state = await driftState(page, id);
		expect(state.status, 'Drift should be detected').toBe('drift_detected');
		expect(
			state.entities
				.map(({ section, title, state }) => ({ section, title, state }))
				.sort((a, b) => a.title.localeCompare(b.title)),
			'Drift should find both formats modified'
		).toEqual(
			FORMATS.map(({ name }) => ({
				section: 'custom_formats',
				title: name,
				state: 'modified'
			})).sort((a, b) => a.title.localeCompare(b.title))
		);
	});

	await test.step('9. Sync and settle', async () => {
		await openTab(page, 'Sync');
		const lastDrift = await latestJobRunId(page, 'arr.drift');
		expect((await syncSection(page, 'Quality Profiles')).status, 'The sync should succeed').toBe(
			'idle'
		);
		expect(heldPatterns(fake), 'Sonarr should carry the edit').toEqual(carrying(LOCAL));
		await waitForNextJobRun(page, 'arr.drift', { afterId: lastDrift });
		expect((await driftState(page, id)).status, 'Drift should be clean').toBe('clean');
	});

	expect(fake.unhandled, 'Sonarr should have had a route for every request').toEqual([]);
});
