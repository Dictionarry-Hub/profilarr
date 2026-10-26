/**
 * An Arr's Renames tab (`/arr/{id}/rename`): its settings and runs, driven
 * the way a user does, plus typed readers for what the tab loads.
 *
 * Saving only stores the settings. Dry Run queues an `arr.rename` job at
 * once. Run Now first asks in the "Rename Now" dialog, and Rename queues the
 * live run. The run helpers wait for the job's run, then reload the tab so
 * its history shows the run.
 *
 * The library the Renames tests share is built here too: title A needs
 * renaming, B is named right, and each title says which names a rename and
 * a folder move would give it.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	chooseOption,
	fillField,
	saveForm,
	setSwitch,
	waitForAction
} from '$flows/helpers/core/forms.ts';
import { latestJobRunId, waitForNextJobRun, type JobRun } from '$flows/helpers/core/jobs.ts';
import { openTab, waitForHydration } from '$flows/helpers/core/nav.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';
import { openArr } from '$flows/helpers/sync/arrs.ts';
import type { ArrType } from '$flows/helpers/sync/fakeArr.ts';
import {
	episodeFile,
	movieFile,
	radarrMovie,
	sonarrSeries,
	type Library
} from '$flows/helpers/sync/library.ts';

/** An instance's stored rename settings */
export interface RenameSettings {
	id: number;
	arrInstanceId: number;
	/** The Schedule switch: automatic runs only, manual runs work either way */
	enabled: boolean;
	renameFolders: boolean;
	ignoreTag: string | null;
	summaryNotifications: boolean;
	cron: string;
	/** ISO timestamps */
	nextRunAt: string | null;
	lastRunAt: string | null;
	createdAt: string;
	updatedAt: string;
}

/** A file's name before and after, relative to its item's folder */
export interface RenamedPath {
	existingPath: string;
	newPath: string;
}

/** One item a run renamed, or a dry run would rename */
export interface RenamedItem {
	id: number;
	title: string;
	/** Full folder paths, when the folder moved */
	folder?: RenamedPath;
	files: RenamedPath[];
	imageUrl?: string;
}

/** One stored run, newest first in the tab's data */
export interface RenameRun {
	id: string;
	instanceId: number;
	startedAt: string;
	completedAt: string;
	status: 'success' | 'partial' | 'failed' | 'skipped';
	config: { dryRun: boolean; renameFolders: boolean; ignoreTag: string | null; manual: boolean };
	library: { totalItems: number; fetchDurationMs: number };
	filtering: { afterIgnoreTag: number; skippedByTag: number };
	results: {
		filesNeedingRename: number;
		filesRenamed: number;
		foldersRenamed: number;
		commandsTriggered: number;
		commandsCompleted: number;
		commandsFailed: number;
		errors: string[];
	};
	renamedItems: RenamedItem[];
	[field: string]: unknown;
}

/** What the Renames tab stores for an instance */
export interface RenamesData {
	/** Null until the first save */
	settings: RenameSettings | null;
	renameRuns: RenameRun[];
}

/** Open an instance's Renames tab from the sidebar */
export async function openRenames(page: Page, name: string): Promise<void> {
	await test.step(
		`Open the Renames tab of ${name}`,
		async () => {
			await openArr(page, name);
			await openTab(page, 'Renames');
			await expect(
				page.getByRole('main').getByRole('heading', { name: 'Rename', exact: true }),
				'The Renames tab should load'
			).toBeVisible();
		},
		{ box: true }
	);
}

/** The instance's stored rename settings and run history, from the Renames tab's data */
export async function renamesData(page: Page, arrId: number): Promise<RenamesData> {
	return await test.step(
		`Read the renames of Arr ${arrId}`,
		async () => {
			const { settings, renameRuns } = await pageData<RenamesData>(page, `/arr/${arrId}/rename`);
			return { settings, renameRuns };
		},
		{ box: true }
	);
}

/** A schedule as the Frequency control sets it */
export type RenameSchedule = { every: number } | { custom: string };

/** Changes to the Renames tab's settings; anything left out stays */
export interface RenameChanges {
	/** The Folders switch */
	folders?: boolean;
	/** The Summary switch */
	summary?: boolean;
	/** The Schedule switch */
	schedule?: boolean;
	/** The Frequency control; it only takes input while Schedule is on */
	frequency?: RenameSchedule;
	/** Typed into Ignore Tag, which turns it lowercase; an empty string clears it */
	ignoreTag?: string;
}

/** Change the settings on the open Renames tab, without saving */
export async function setRenameSettings(page: Page, changes: RenameChanges): Promise<void> {
	await test.step(
		'Set the rename settings',
		async () => {
			const main = page.getByRole('main');
			if (changes.folders !== undefined) await setSwitch(main, 'Folders', changes.folders);
			if (changes.summary !== undefined) await setSwitch(main, 'Summary', changes.summary);
			if (changes.schedule !== undefined) await setSwitch(main, 'Schedule', changes.schedule);
			if (changes.frequency && 'every' in changes.frequency) {
				await chooseOption(main, 'Frequency', 'Every');
				await fillField(main, 'Interval in Minutes', changes.frequency.every);
			} else if (changes.frequency) {
				await chooseOption(main, 'Frequency', 'Custom');
				await fillField(main, 'Custom cron', changes.frequency.custom);
			}
			if (changes.ignoreTag !== undefined) {
				const field = main.getByRole('textbox', { name: 'Ignore Tag', exact: true });
				await expect(field, 'The Ignore Tag field should be shown').toBeVisible();
				await field.fill(changes.ignoreTag);
				await expect(field, 'Ignore Tag should hold the tag in lowercase').toHaveValue(
					changes.ignoreTag.toLowerCase()
				);
			}
		},
		{ box: true }
	);
}

/** Click Save on the open Renames tab and wait until it is stored and Save turns off again */
export async function saveRenames(page: Page): Promise<void> {
	await test.step(
		'Save the rename settings',
		async () => {
			await saveForm(page);
			await expect(
				page.getByRole('main').getByRole('button', { name: 'Save', exact: true }),
				'Save should turn off once the settings are stored'
			).toBeDisabled();
		},
		{ box: true }
	);
}

/** Wait for the `arr.rename` run a click queues, then reload the tab to show it */
async function runQueued(page: Page, queue: () => Promise<void>): Promise<JobRun> {
	const afterId = await latestJobRunId(page, 'arr.rename');
	await queue();
	const run = await waitForNextJobRun(page, 'arr.rename', { afterId });
	await page.reload();
	await waitForHydration(page);
	return run;
}

/** Wait for the `run` action a click posts and check it queued the run */
async function expectQueued(page: Page, click: () => Promise<void>, what: string): Promise<void> {
	const queued = waitForAction(page, 'run');
	await click();
	const result = await queued;
	expect(result.type, `The ${what} should be queued: ${JSON.stringify(result.data)}`).toBe(
		'success'
	);
}

/** Click Dry Run on the open Renames tab and wait for the run; returns the job run */
export async function dryRun(page: Page): Promise<JobRun> {
	return await test.step(
		'Start a dry run',
		async () =>
			await runQueued(page, () =>
				expectQueued(
					page,
					() =>
						page.getByRole('main').getByRole('button', { name: 'Dry Run', exact: true }).click(),
					'dry run'
				)
			),
		{ box: true }
	);
}

/** The "Rename Now" dialog Run Now opens */
export function renameNowDialog(page: Page): Locator {
	return page.getByRole('dialog', { name: 'Rename Now', exact: true });
}

/** Click Run Now on the open Renames tab and wait for the "Rename Now" dialog; returns it */
export async function openRenameNow(page: Page): Promise<Locator> {
	return await test.step(
		'Open the Rename Now dialog',
		async () => {
			await page.getByRole('main').getByRole('button', { name: 'Run Now', exact: true }).click();
			const dialog = renameNowDialog(page);
			await expect(dialog, 'Run Now should open the Rename Now dialog').toBeVisible();
			return dialog;
		},
		{ box: true }
	);
}

/** Click Rename in the open "Rename Now" dialog and wait for the live run; returns the job run */
export async function confirmRenameNow(page: Page): Promise<JobRun> {
	return await test.step(
		'Confirm the live run',
		async () =>
			await runQueued(page, () =>
				expectQueued(
					page,
					async () => {
						const dialog = renameNowDialog(page);
						await dialog.getByRole('button', { name: 'Rename', exact: true }).click();
						await expect(dialog, 'The Rename Now dialog should close').toHaveCount(0);
					},
					'live run'
				)
			),
		{ box: true }
	);
}

/** Click Cancel in the open "Rename Now" dialog and wait for it to close */
export async function cancelRenameNow(page: Page): Promise<void> {
	await test.step(
		'Cancel the live run',
		async () => {
			const dialog = renameNowDialog(page);
			await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
			await expect(dialog, 'The Rename Now dialog should close').toHaveCount(0);
		},
		{ box: true }
	);
}

/** Click Run Now, confirm with Rename and wait for the live run; returns the job run */
export async function runNow(page: Page): Promise<JobRun> {
	return await test.step(
		'Run a live rename',
		async () => {
			await openRenameNow(page);
			return await confirmRenameNow(page);
		},
		{ box: true }
	);
}

/** The run history's row for run `#n`, counted from the oldest */
export function runRow(page: Page, runNumber: number): Locator {
	return page
		.getByRole('main')
		.getByRole('row')
		.filter({ has: page.getByRole('cell', { name: `#${runNumber}`, exact: true }) });
}

/**
 * Expand run `#n` in the run history and return its details: config,
 * library, filtering, results, errors and the items table. They have no
 * name of their own, so this takes the row that follows.
 */
export async function expandRun(page: Page, runNumber: number): Promise<Locator> {
	return await test.step(
		`Expand run #${runNumber}`,
		async () => {
			const row = runRow(page, runNumber);
			await expect(row, `The run history should show run #${runNumber}`).toBeVisible();
			const expand = row.getByRole('button', { name: 'Expand', exact: true });
			if (await expand.isVisible()) await expand.click();
			await expect(
				row.getByRole('button', { name: 'Collapse', exact: true }),
				`Run #${runNumber} should be expanded`
			).toBeVisible();
			const details = row.locator('xpath=following-sibling::tr[1]');
			await expect(
				details.getByText('Results', { exact: true }),
				`Run #${runNumber}'s details should show`
			).toBeVisible();
			return details;
		},
		{ box: true }
	);
}

/** A file's name now and the name a rename would give it, the same when it's named right */
export interface TitleFile {
	/** Relative to the title's folder; Sonarr's start with the season folder */
	from: string;
	to: string;
	/** Sonarr: the file's season */
	season?: number;
}

/** A title in a Renames test's library, and what a rename would change */
export interface RenameTitle {
	id: number;
	title: string;
	files: TitleFile[];
	/** The root folder; default /movies or /tv */
	rootFolderPath?: string;
	/** The folder name a move would give it; left out when its folder is right */
	folderTo?: string;
	/** Tag names */
	tags?: string[];
}

/** The root folder titles live under unless they set their own */
export const ROOT_FOLDER: Record<ArrType, string> = { radarr: '/movies', sonarr: '/tv' };

/** A second root folder, for a title that lives apart from the others */
export const SECOND_ROOT: Record<ArrType, string> = { radarr: '/movies2', sonarr: '/tv2' };

/** Title A, whose files need renaming: one movie file, or two episodes with new titles */
export function titleA(app: ArrType): RenameTitle {
	return app === 'radarr'
		? {
				id: 1,
				title: 'Alpha',
				files: [{ from: 'alpha.mkv', to: 'Alpha (2020) Bluray-1080p.mkv' }]
			}
		: {
				id: 1,
				title: 'Alpha',
				files: [
					{
						from: 'Season 01/Alpha - S01E01 - TBA.mkv',
						to: 'Season 01/Alpha - S01E01 - Pilot.mkv',
						season: 1
					},
					{
						from: 'Season 01/Alpha - S01E02 - TBA.mkv',
						to: 'Season 01/Alpha - S01E02 - Second.mkv',
						season: 1
					}
				]
			};
}

/** Title B, already named right */
export function titleB(app: ArrType): RenameTitle {
	const name = app === 'radarr' ? 'Bravo (2020) Bluray-1080p.mkv' : 'Season 01/Bravo - S01E01.mkv';
	return {
		id: 2,
		title: 'Bravo',
		files: [{ from: name, to: name, ...(app === 'sonarr' ? { season: 1 } : {}) }]
	};
}

/** `count` titles numbered from 1, each with one file to rename, e.g. to fill rename batches */
export function numberedTitles(app: ArrType, count: number): RenameTitle[] {
	return Array.from({ length: count }, (_, index) => {
		const id = index + 1;
		const file =
			app === 'radarr'
				? { from: `title-${id}.mkv`, to: `Title ${id} (2020).mkv` }
				: {
						from: `Season 01/Title ${id} - S01E01 - TBA.mkv`,
						to: `Season 01/Title ${id} - S01E01 - Pilot.mkv`,
						season: 1
					};
		return { id, title: `Title ${id}`, files: [file] };
	});
}

/** The folder a title has now and the one a move gives it, as full paths */
export function folderOf(app: ArrType, title: RenameTitle): RenamedPath {
	const root = title.rootFolderPath ?? ROOT_FOLDER[app];
	return {
		existingPath: `${root}/${title.title}`,
		newPath: `${root}/${title.folderTo ?? title.title}`
	};
}

/** The renames a run records for a title's files: only those whose name changes */
export function renamesOf(title: RenameTitle): RenamedPath[] {
	return title.files
		.filter((file) => file.from !== file.to)
		.map((file) => ({ existingPath: file.from, newPath: file.to }));
}

/** The library for these titles, as `seedLibrary` takes it */
export function renameLibrary(app: ArrType, titles: RenameTitle[]): Library {
	const place = (title: RenameTitle) => ({
		id: title.id,
		title: title.title,
		tags: title.tags,
		rootFolderPath: title.rootFolderPath ?? ROOT_FOLDER[app],
		folderTo: title.folderTo
	});
	if (app === 'radarr') {
		return {
			items: titles.map((title) => radarrMovie(place(title))),
			files: titles.flatMap((title) =>
				title.files.map((file) =>
					movieFile(title.id, 0, [], { relativePath: file.from, renameTo: file.to })
				)
			)
		};
	}
	return {
		items: titles.map((title) => {
			const seasons = [...new Set(title.files.map((file) => file.season ?? 1))].map((season) => ({
				seasonNumber: season,
				episodeFileCount: title.files.filter((file) => (file.season ?? 1) === season).length
			}));
			return sonarrSeries({ ...place(title), seasons });
		}),
		files: titles.flatMap((title) =>
			title.files.map((file) =>
				episodeFile(title.id, file.season ?? 1, 0, { relativePath: file.from, renameTo: file.to })
			)
		)
	};
}
