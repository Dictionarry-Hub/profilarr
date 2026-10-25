/**
 * An Arr's Upgrades tab (`/arr/{id}/upgrades`): its settings, filters,
 * preview and runs, driven the way a user does, plus typed readers for what
 * the tab loads.
 *
 * Saving only stores the config. Dry Run queues an `arr.upgrade` job, and so
 * does a live run, whose button only exists in dev builds; `liveRun` posts
 * the same `run` action straight to the server. Both wait for the job's run.
 *
 * Filter settings sit in the filter's expanded row, and rules share the names
 * Field, Operator and Value, so `buildRules` finds each rule's controls by
 * position: a rule it adds is always the last one on the page.
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
import { pageData, unflatten } from '$flows/helpers/core/pageData.ts';
import { openArr } from '$flows/helpers/sync/arrs.ts';

/** A stored rule: a field, an operator and a value, as the app's ids */
export interface FilterRule {
	type: 'rule';
	field: string;
	operator: string;
	value: string | number | boolean | null;
}

/** A stored group of rules and groups */
export interface FilterGroup {
	type: 'group';
	match: 'all' | 'any';
	children: (FilterRule | FilterGroup)[];
}

/** A stored filter */
export interface UpgradeFilter {
	id: string;
	name: string;
	enabled: boolean;
	group: FilterGroup;
	selector: string;
	count: number;
	cutoff: number;
	tag?: string;
}

/** An instance's stored upgrade config */
export interface UpgradeConfig {
	id: number;
	arrInstanceId: number;
	enabled: boolean;
	cron: string;
	/** ISO timestamps */
	nextRunAt: string | null;
	lastRunAt: string | null;
	filterMode: 'round_robin' | 'random';
	filters: UpgradeFilter[];
	currentFilterIndex: number;
	createdAt?: string;
	updatedAt?: string;
}

/** A release a run found or grabbed for an item */
export interface UpgradeRelease {
	release: string;
	formats: string[];
	score: number;
	/** Sonarr: the season it is for */
	seasonNumber?: number;
}

/** One item a run selected, with what it has now and what it found */
export interface UpgradeRunItem {
	id: number;
	title: string;
	original:
		| { type: 'movie'; fileName: string; formats: string[]; score: number }
		| {
				type: 'series';
				title: string;
				episodes: { seasonNumber: number; fileName: string; formats: string[]; score: number }[];
		  };
	upgrades: UpgradeRelease[];
	imageUrl?: string;
	/** Sonarr dry runs: the season it searched */
	searchedSeasonNumber?: number;
}

/** One stored run, newest first in the tab's data */
export interface UpgradeRun {
	id: string;
	instanceId: number;
	startedAt: string;
	completedAt: string;
	status: 'success' | 'partial' | 'failed' | 'skipped';
	config: { cron: string; filterMode: string; selectedFilter: string; dryRun: boolean };
	library: { totalItems: number; fetchedFromCache: boolean; fetchDurationMs: number };
	filter: {
		id: string;
		name: string;
		matchedCount: number;
		afterCooldown: number;
		dryRunExcluded: number;
	};
	selection: {
		method: string;
		requestedCount: number;
		actualCount: number;
		items: UpgradeRunItem[];
	};
	results: { searchesTriggered: number; successful: number; failed: number; errors: string[] };
}

/** What the Upgrades tab stores for an instance */
export interface UpgradesData {
	config: UpgradeConfig | null;
	upgradeRuns: UpgradeRun[];
}

/** The filter group a new filter starts with, per app */
export function defaultGroup(app: 'radarr' | 'sonarr'): FilterGroup {
	const monitored: FilterRule = { type: 'rule', field: 'monitored', operator: 'is', value: true };
	const status = (value: string): FilterRule => ({
		type: 'rule',
		field: 'status',
		operator: 'eq',
		value
	});
	return app === 'radarr'
		? { type: 'group', match: 'all', children: [monitored, status('released')] }
		: {
				type: 'group',
				match: 'all',
				children: [
					monitored,
					{ type: 'group', match: 'any', children: [status('continuing'), status('ended')] }
				]
			};
}

/** Open an instance's Upgrades tab from the sidebar */
export async function openUpgrades(page: Page, name: string): Promise<void> {
	await test.step(
		`Open the Upgrades tab of ${name}`,
		async () => {
			await openArr(page, name);
			await openTab(page, 'Upgrades');
			await expect(
				page.getByRole('main').getByRole('heading', { name: 'Upgrades', exact: true }),
				'The Upgrades tab should load'
			).toBeVisible();
		},
		{ box: true }
	);
}

/** The instance's stored upgrade config and run history, from the Upgrades tab's data */
export async function upgradesData(page: Page, arrId: number): Promise<UpgradesData> {
	return await test.step(
		`Read the upgrades of Arr ${arrId}`,
		async () => {
			const { config, upgradeRuns } = await pageData<UpgradesData>(page, `/arr/${arrId}/upgrades`);
			return { config, upgradeRuns };
		},
		{ box: true }
	);
}

/** A schedule as the Frequency control sets it */
export type UpgradeSchedule = { every: number } | { custom: string };

export interface UpgradeCore {
	/** The Status switch */
	enabled?: boolean;
	schedule?: UpgradeSchedule;
	/** The Mode dropdown, e.g. "Random Shuffle" */
	mode?: 'Round Robin' | 'Random Shuffle';
}

/** Set Status, the schedule and the mode at the top of the open Upgrades tab, without saving */
export async function setUpgradeCore(page: Page, core: UpgradeCore): Promise<void> {
	await test.step(
		'Set the upgrade status, schedule and mode',
		async () => {
			const main = page.getByRole('main');
			if (core.enabled !== undefined) await setSwitch(main, 'Status', core.enabled);
			if (core.schedule && 'every' in core.schedule) {
				await chooseOption(main, 'Frequency', 'Every');
				await fillField(main, 'Interval in Minutes', core.schedule.every);
			} else if (core.schedule) {
				await chooseOption(main, 'Frequency', 'Custom');
				await fillField(main, 'Custom cron', core.schedule.custom);
			}
			if (core.mode !== undefined) await chooseOption(main, 'Mode', core.mode);
		},
		{ box: true }
	);
}

/**
 * Keep a test clear of the next wall-clock mark of a `*\/minutes` schedule,
 * such as :00 and :30 for 30, so a scheduled run can't land while it checks
 * the stored config. The app's cron runs on the container's clock, which is
 * UTC. When the mark is under 45 seconds away, wait until a few seconds past
 * it, and give the test that much more time; otherwise return at once.
 */
export async function clearOfScheduleMark(minutes: number): Promise<void> {
	await test.step(
		`Keep clear of the next every-${minutes}-minutes mark`,
		async () => {
			const period = minutes * 60_000;
			const untilMark = Math.ceil(Date.now() / period) * period - Date.now();
			if (untilMark >= 45_000) return;
			const wait = untilMark + 5_000;
			test.info().setTimeout(test.info().timeout + wait);
			await new Promise((resolveWait) => setTimeout(resolveWait, wait));
		},
		{ box: true }
	);
}

/** Pick an item of the Add filter menu, which opens on hover */
async function addFilterFrom(page: Page, item: 'Default' | 'Import'): Promise<void> {
	const main = page.getByRole('main');
	const add = main.getByRole('button', { name: 'Add filter', exact: true });
	await expect(add, 'The Add filter button should be shown').toBeVisible();
	await add.hover();
	const menu = main
		.getByRole('group')
		.filter({ has: page.getByRole('button', { name: 'Add filter' }) });
	await menu.getByRole('button', { name: item, exact: true }).click();
}

/** The filter list's row for a filter, the one with its Preview button */
export function filterRow(page: Page, name: string): Locator {
	return page
		.getByRole('main')
		.getByRole('row')
		.filter({ has: page.getByText(name, { exact: true }) })
		.filter({ has: page.getByRole('button', { name: 'Preview', exact: true }) });
}

/**
 * The expanded settings of a filter, below its row, expanding the row first
 * when it is collapsed. They have no name of their own, so this takes the row
 * that follows.
 */
export async function filterPanel(page: Page, name: string): Promise<Locator> {
	const row = filterRow(page, name);
	await expect(row, `The filter list should show ${name}`).toBeVisible();
	const expand = row.getByRole('button', { name: 'Expand', exact: true });
	if (await expand.isVisible()) await expand.click();
	await expect(
		row.getByRole('button', { name: 'Collapse', exact: true }),
		`${name} should be expanded`
	).toBeVisible();
	const panel = row.locator('xpath=following-sibling::tr[1]');
	await expect(
		panel.getByRole('button', { name: /^Method: / }),
		`${name}'s settings should show`
	).toBeVisible();
	return panel;
}

/** Add a filter from Add filter › Default; it gets the next free name, "Filter", "Filter 2", ... */
export async function addDefaultFilter(page: Page): Promise<void> {
	await test.step(
		'Add a Default filter',
		async () => {
			const before = await page.getByRole('main').getByRole('button', { name: 'Preview' }).count();
			await addFilterFrom(page, 'Default');
			await expect(
				page.getByRole('main').getByRole('button', { name: 'Preview' }),
				'The filter list should gain a filter'
			).toHaveCount(before + 1);
		},
		{ box: true }
	);
}

/** Paste a filter's JSON into Add filter › Import and confirm it */
export async function importFilter(page: Page, filter: object): Promise<void> {
	await test.step(
		'Import a filter',
		async () => {
			await addFilterFrom(page, 'Import');
			const dialog = page.getByRole('dialog', { name: 'Import Filter', exact: true });
			await expect(dialog, 'The Import Filter dialog should open').toBeVisible();
			await dialog
				.getByRole('textbox', { name: 'Filter JSON', exact: true })
				.fill(JSON.stringify(filter));
			await dialog.getByRole('button', { name: 'Import', exact: true }).click();
			await expect(dialog, 'The Import Filter dialog should close').toHaveCount(0);
		},
		{ box: true }
	);
}

/** Changes to a filter's row and settings; anything left out stays */
export interface FilterChanges {
	/** A new name, typed after clicking the pencil */
	rename?: string;
	/** Click Enable or Disable when it differs */
	enabled?: boolean;
	/** The Method dropdown, e.g. "Oldest" */
	method?: string;
	count?: number;
	cutoff?: number;
	/** The Cooldown Tag field */
	tag?: string;
}

/** Change a filter in the open Upgrades tab, without saving */
export async function editFilter(page: Page, name: string, changes: FilterChanges): Promise<void> {
	await test.step(
		`Edit the filter ${name}`,
		async () => {
			let current = name;
			if (changes.rename !== undefined) {
				const pencil = filterRow(page, name).getByRole('button', {
					name: 'Rename filter',
					exact: true
				});
				await expect(pencil, 'The pencil should be named "Rename filter"').toBeVisible();
				await pencil.click();
				// The name turns into this field, so the row no longer shows it
				const field = page
					.getByRole('main')
					.getByRole('textbox', { name: 'Filter name', exact: true });
				await field.fill(changes.rename);
				await field.press('Enter');
				current = changes.rename;
				await expect(
					filterRow(page, current),
					`The filter should be named ${current}`
				).toBeVisible();
			}
			if (changes.enabled !== undefined) {
				const row = filterRow(page, current);
				const toggle = row.getByRole('button', {
					name: changes.enabled ? 'Enable' : 'Disable',
					exact: true
				});
				if (await toggle.isVisible()) await toggle.click();
				await expect(
					row.getByText('Disabled', { exact: true }),
					`${current} should be ${changes.enabled ? 'enabled' : 'disabled'}`
				).toHaveCount(changes.enabled ? 0 : 1);
			}
			const settings = [changes.method, changes.count, changes.cutoff, changes.tag];
			if (settings.every((setting) => setting === undefined)) return;
			const panel = await filterPanel(page, current);
			if (changes.method !== undefined) await chooseOption(panel, 'Method', changes.method);
			if (changes.count !== undefined) await fillField(panel, 'Count', changes.count);
			if (changes.cutoff !== undefined) await fillField(panel, 'Cutoff %', changes.cutoff);
			if (changes.tag !== undefined) await fillField(panel, 'Cooldown Tag', changes.tag);
		},
		{ box: true }
	);
}

/** Click Save on the open Upgrades tab and wait until it is stored and Save turns off again */
export async function saveUpgrades(page: Page): Promise<void> {
	await test.step(
		'Save the upgrade settings',
		async () => {
			await saveForm(page, { action: 'save' });
			await expect(
				page.getByRole('main').getByRole('button', { name: 'Save', exact: true }),
				'Save should turn off once the settings are stored'
			).toBeDisabled();
		},
		{ box: true }
	);
}

/** How a rule's value is set: picked from a dropdown, typed, or a date */
export type RuleValue = { pick: string } | { text: string } | { number: number } | { date: string };

/** A rule as a user picks it, by the labels the dropdowns show, e.g. Year, ≥, 2010 */
export interface RuleInput {
	field: string;
	operator: string;
	/** Left out for an operator without a value, such as "has none" */
	value?: RuleValue;
}

/** A group as a user builds it. A nested group starts with a rule, so its first child must be one. */
export interface GroupInput {
	match: 'all' | 'any';
	children: (RuleInput | GroupInput)[];
}

const MATCH_LABELS = { all: 'All (AND)', any: 'Any (OR)' } as const;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Open a dropdown from its button and pick an option. A searchable dropdown
 * opens a listbox named after its label, a plain one shows its options as
 * buttons.
 */
async function pick(page: Page, trigger: Locator, label: string, option: string): Promise<void> {
	await expect(trigger, `The ${label} dropdown should be shown`).toBeVisible();
	await trigger.click();
	const choice = page
		.getByRole('listbox', { name: label, exact: true })
		.getByRole('option', { name: option, exact: true })
		.or(page.getByRole('button', { name: option, exact: true }))
		.filter({ visible: true });
	await expect(choice.first(), `The ${label} dropdown should offer ${option}`).toBeVisible();
	await choice.first().click();
	await expect(choice, `The ${label} dropdown should close`).toHaveCount(0);
}

/**
 * Build a filter's rules in its expanded settings, the way a user does: the
 * default rules are removed with their X buttons, then each rule and group
 * is added in order with Add Rule and Add Group. A typed value is found by
 * its label, so each text Value field must be named on its own.
 */
export async function buildRules(page: Page, filter: string, group: GroupInput): Promise<void> {
	await test.step(
		`Build the rules of ${filter}`,
		async () => {
			const panel = await filterPanel(page, filter);
			const field = panel.getByRole('button', { name: /^Field: / });

			for (const name of ['Remove group', 'Remove rule']) {
				const remove = panel.getByRole('button', { name, exact: true });
				for (let left = await remove.count(); left > 0; left = await remove.count()) {
					await remove.first().click();
					await expect(remove, `${name} should take one away`).not.toHaveCount(left);
				}
			}
			await expect(field, 'The default rules should be removed with their X buttons').toHaveCount(
				0
			);
			await pick(
				page,
				panel.getByRole('button', { name: /^Match: / }).first(),
				'Match',
				MATCH_LABELS[group.match]
			);

			let textFields = 0;
			async function setLastRule(rule: RuleInput): Promise<void> {
				await pick(page, field.last(), 'Field', rule.field);
				await pick(
					page,
					panel.getByRole('button', { name: /^Operator: / }).last(),
					'Operator',
					rule.operator
				);
				const value = rule.value;
				if (!value) return;
				if ('pick' in value) {
					const trigger = panel.getByRole('button', { name: /^Value: / }).last();
					await expect(trigger, 'The Value options should have loaded').not.toHaveAccessibleName(
						/Loading values/
					);
					await pick(page, trigger, 'Value', value.pick);
				} else if ('text' in value) {
					textFields++;
					const typed = panel.getByRole('textbox', { name: 'Value', exact: true });
					await expect(typed, 'Each text Value field should be named by its own label').toHaveCount(
						textFields
					);
					await typed.last().fill(value.text);
					await expect(typed.last(), `Value should hold ${value.text}`).toHaveValue(value.text);
				} else if ('number' in value) {
					const number = panel.getByRole('spinbutton', { name: 'Value', exact: true }).last();
					await number.fill(String(value.number));
					await number.press('Tab');
					await expect(number, `Value should hold ${value.number}`).toHaveValue(
						String(value.number)
					);
				} else {
					const [year, month, day] = value.date.split('-');
					const part = (name: string) =>
						panel.getByRole('button', { name: new RegExp(`^Date ${name}: `) }).last();
					await pick(page, part('Year'), 'Date Year', year);
					await pick(page, part('Month'), 'Date Month', MONTHS[Number(month) - 1]);
					await pick(page, part('Day'), 'Date Day', day);
				}
			}

			/**
			 * Add children to the group at `depth`, which is the last child of
			 * each group above it, so their buttons follow its own, one per level
			 */
			async function addChildren(children: GroupInput['children'], depth: number): Promise<void> {
				const button = async (name: string) => {
					const all = panel.getByRole('button', { name, exact: true });
					return all.nth((await all.count()) - 1 - depth);
				};
				for (const child of children) {
					if (!('children' in child)) {
						await (await button('Add Rule')).click();
						await setLastRule(child);
						continue;
					}
					await (await button('Add Group')).click();
					const match = panel.getByRole('button', { name: /^Match: / }).last();
					await pick(page, match, 'Match', MATCH_LABELS[child.match]);
					// A new group already holds one rule, which becomes its first
					const [first, ...rest] = child.children;
					if (!first || 'children' in first) {
						throw new Error('buildRules needs each nested group to start with a rule');
					}
					await setLastRule(first);
					await addChildren(rest, depth + 1);
				}
			}
			await addChildren(group.children, 0);
		},
		{ box: true }
	);
}

/** One item of a filter preview */
export interface PreviewItem {
	id: number;
	title: string;
	year: number;
	status: 'selected' | 'selectable' | 'cooldown' | 'filtered_out';
	reason: string;
	details: Record<string, unknown>;
}

/** What `/arr/{id}/upgrades/preview` answers */
export interface FilterPreview {
	filterName: string;
	totalItems: number;
	matchedCount: number;
	cooldownCount: number;
	selectableCount: number;
	selectedCount: number;
	requestedCount: number;
	selector: string;
	items: PreviewItem[];
}

/** The preview dialog of a filter */
export function previewDialog(page: Page, name: string): Locator {
	return page.getByRole('dialog', { name: `Preview: ${name}`, exact: true });
}

/** Click a filter's Preview button and wait for the preview it loads; returns it */
export async function previewFilter(page: Page, name: string): Promise<FilterPreview> {
	return await test.step(
		`Preview the filter ${name}`,
		async () => {
			const loaded = page.waitForResponse(
				(response) =>
					response.request().method() === 'POST' &&
					/^\/arr\/\d+\/upgrades\/preview$/.test(new URL(response.url()).pathname)
			);
			await filterRow(page, name).getByRole('button', { name: 'Preview', exact: true }).click();
			const response = await loaded;
			expect(response.ok(), `The preview should answer: ${await response.text()}`).toBe(true);
			await expect(
				previewDialog(page, name).getByText('Library', { exact: true }),
				'The preview dialog should show its result'
			).toBeVisible();
			return (await response.json()) as FilterPreview;
		},
		{ box: true }
	);
}

/** Close a filter's preview dialog with its Close button */
export async function closePreview(page: Page, name: string): Promise<void> {
	await test.step(
		`Close the preview of ${name}`,
		async () => {
			const dialog = previewDialog(page, name);
			await dialog.getByRole('button', { name: 'Close', exact: true }).click();
			await expect(dialog, 'The preview dialog should close').toHaveCount(0);
		},
		{ box: true }
	);
}

/** A filter to preview, as the preview endpoint takes it */
export interface PreviewInput {
	group: FilterGroup;
	selector: string;
	count: number;
	cutoff?: number;
	name?: string;
	tag?: string;
}

/** Post a filter straight to the preview endpoint, the way the Preview button does */
export async function postPreview(
	page: Page,
	arrId: number,
	filter: PreviewInput
): Promise<FilterPreview> {
	return await test.step(
		`Preview a ${filter.selector} filter`,
		async () => {
			const response = await page.request.post(`/arr/${arrId}/upgrades/preview`, {
				data: {
					filter: { id: 'flow-preview', name: 'Preview', enabled: true, cutoff: 100, ...filter }
				}
			});
			expect(response.ok(), `The preview should answer: ${await response.text()}`).toBe(true);
			return (await response.json()) as FilterPreview;
		},
		{ box: true }
	);
}

/** The ids a preview gives a status, in its order */
export function previewIds(preview: FilterPreview, status: PreviewItem['status']): number[] {
	return preview.items.filter((item) => item.status === status).map((item) => item.id);
}

/** Wait for the `arr.upgrade` run a click or post queues, then reload the tab to show it */
async function runQueued(page: Page, queue: () => Promise<unknown>): Promise<JobRun> {
	const afterId = await latestJobRunId(page, 'arr.upgrade');
	await queue();
	const run = await waitForNextJobRun(page, 'arr.upgrade', { afterId });
	await page.reload();
	await waitForHydration(page);
	return run;
}

/** Click Dry Run on the open Upgrades tab and wait for the run; returns the job run */
export async function dryRun(page: Page): Promise<JobRun> {
	return await test.step(
		'Start a dry run',
		async () =>
			await runQueued(page, async () => {
				const queued = waitForAction(page, 'run');
				await page.getByRole('main').getByRole('button', { name: 'Dry Run', exact: true }).click();
				const result = await queued;
				expect(result.type, `The dry run should be queued: ${JSON.stringify(result.data)}`).toBe(
					'success'
				);
			}),
		{ box: true }
	);
}

/**
 * Start a live run by posting the tab's `run` action with `dryRun=false`, as
 * the dev-only Live Run button does, and wait for the run; returns the job run
 */
export async function liveRun(page: Page, arrId: number): Promise<JobRun> {
	return await test.step(
		'Start a live run',
		async () =>
			await runQueued(page, async () => {
				const response = await page.request.post(`/arr/${arrId}/upgrades?/run`, {
					form: { dryRun: 'false' },
					headers: {
						// SvelteKit refuses form posts from another origin before the action runs
						origin: new URL(page.url()).origin,
						'x-sveltekit-action': 'true',
						accept: 'application/json'
					}
				});
				const result = (await response.json()) as { type: string; data?: string };
				const data = result.data === undefined ? undefined : unflatten(JSON.parse(result.data));
				expect(result.type, `The live run should be queued: ${JSON.stringify(data)}`).toBe(
					'success'
				);
			}),
		{ box: true }
	);
}

/** Click Reset Cache on the open Upgrades tab and wait for the cache to clear */
export async function resetDryRunCache(page: Page): Promise<void> {
	await test.step(
		'Reset the dry run cache',
		async () => {
			const cleared = waitForAction(page, 'clearCache');
			await page
				.getByRole('main')
				.getByRole('button', { name: 'Reset Cache', exact: true })
				.click();
			const result = await cleared;
			expect(result.type, `Reset Cache should succeed: ${JSON.stringify(result.data)}`).toBe(
				'success'
			);
		},
		{ box: true }
	);
}
