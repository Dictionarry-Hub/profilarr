// Rows on the Arr card. Left of the dot: what the job is or did last.
// Right of the dot (muted): when it runs next.
import RefreshCw from '@lucide/svelte/icons/refresh-cw';
import Sliders from '@lucide/svelte/icons/sliders-vertical';
import Clock from '@lucide/svelte/icons/clock';
import Tag from '@lucide/svelte/icons/tag';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import ArrowUpCircle from '@lucide/svelte/icons/circle-arrow-up';
import FileEdit from '@lucide/svelte/icons/file-pen';
import Trash2 from '@lucide/svelte/icons/trash';
import Library from '@lucide/svelte/icons/library';
import type { CardRowOption } from '#stores/dataPage.ts';
import type { ArrInstanceSummary, SectionActivity } from '#routes/arr/+page.server.ts';

export type LineTone = 'default' | 'muted' | 'ok' | 'warn' | 'danger';

/** What a row shows on the right: its value, and when it runs next. */
interface LineValue {
	value: string;
	tone: LineTone;
	/** Show a check before the value. */
	check?: boolean;
	/** When the job runs next, shown muted after the dot. */
	nextAt?: string | null;
}

export interface CardLine extends LineValue {
	key: string;
	label: string;
	icon: CardRowOption['icon'];
}

export const lineToneClass: Record<LineTone, string> = {
	default: 'text-neutral-900 dark:text-neutral-100',
	muted: 'text-neutral-400 dark:text-neutral-500',
	ok: 'text-emerald-600 dark:text-emerald-400',
	warn: 'text-amber-600 dark:text-amber-400',
	danger: 'text-red-600 dark:text-red-400'
};

/** Every row an Arr card can show, in card order, for the card rows picker. */
export const ARR_CARD_ROWS = [
	{
		key: 'sync',
		label: 'Sync',
		icon: RefreshCw,
		description: 'All sync sections combined',
		defaultVisible: true
	},
	{
		key: 'qualityProfileSync',
		label: 'Quality Profile Sync',
		icon: Sliders,
		defaultVisible: false
	},
	{ key: 'delayProfileSync', label: 'Delay Profile Sync', icon: Clock, defaultVisible: false },
	{ key: 'mediaManagementSync', label: 'Media Management Sync', icon: Tag, defaultVisible: false },
	{ key: 'drift', label: 'Drift', icon: ArrowLeftRight, defaultVisible: true },
	{ key: 'upgrades', label: 'Upgrades', icon: ArrowUpCircle, defaultVisible: true },
	{ key: 'renames', label: 'Renames', icon: FileEdit, defaultVisible: true },
	{ key: 'cleanup', label: 'Cleanup', icon: Trash2, defaultVisible: false },
	{ key: 'library', label: 'Library', icon: Library, defaultVisible: true }
] as const satisfies readonly CardRowOption[];

type ArrRowKey = (typeof ARR_CARD_ROWS)[number]['key'];

const count = (n: number, one: string, many: string) =>
	`${n.toLocaleString()} ${n === 1 ? one : many}`;

const triggerLabel: Record<SectionActivity['trigger'], string> = {
	schedule: 'Scheduled',
	on_pull: 'On Pull',
	manual: 'Manual'
};

function sectionValue(section: SectionActivity): LineValue {
	if (!section.configured) return { value: 'Not Set Up', tone: 'muted' };
	if (section.status === 'in_progress') return { value: 'Syncing', tone: 'ok' };
	const nextAt = section.nextAt;
	if (section.status === 'failed') return { value: 'Failed', tone: 'danger', nextAt };
	return { value: triggerLabel[section.trigger], tone: 'default', nextAt };
}

/**
 * All three sync sections in one row. Failures win, then a running sync, then the
 * shared trigger ("Mixed" when they differ). The time is the soonest scheduled run.
 * Sections with nothing chosen to sync are left out.
 */
function syncSummaryValue(sections: SectionActivity[]): LineValue {
	const configured = sections.filter((section) => section.configured);
	if (configured.length === 0) return { value: 'Not Set Up', tone: 'muted' };

	const nextAt =
		configured
			.map((section) => section.nextAt)
			.filter((at): at is string => at !== null)
			.sort()[0] ?? null;

	const failed = configured.filter((section) => section.status === 'failed').length;
	if (failed > 0) return { value: `${failed} Failed`, tone: 'danger', nextAt };
	if (configured.some((section) => section.status === 'in_progress'))
		return { value: 'Syncing', tone: 'ok' };

	const triggers = new Set(configured.map((section) => section.trigger));
	const [trigger] = triggers;
	const value = triggers.size === 1 ? triggerLabel[trigger] : 'Mixed';
	return { value, tone: 'default', nextAt };
}

function driftValue(drift: ArrInstanceSummary['activity']['drift']): LineValue {
	const { status, nextAt } = drift;
	if (status === 'drift_detected')
		return { value: count(drift.count, 'Difference', 'Differences'), tone: 'warn', nextAt };
	if (status === 'clean') return { value: 'In Sync', tone: 'ok', check: true, nextAt };
	if (status === 'failed') return { value: 'Failed', tone: 'danger', nextAt };
	return { value: 'Not Checked', tone: 'muted', nextAt };
}

function jobValue(
	enabled: boolean,
	nextAt: string | null,
	lastResult: string | null,
	lastFailed: boolean
): LineValue {
	if (!enabled) return { value: 'Off', tone: 'muted' };
	if (lastFailed) return { value: 'Failed', tone: 'danger', nextAt };
	return { value: lastResult ?? 'Not Run Yet', tone: lastResult ? 'default' : 'muted', nextAt };
}

function rowValue(key: ArrRowKey, instance: ArrInstanceSummary): LineValue {
	const { sync, drift, upgrades, renames, cleanup, library } = instance.activity;
	switch (key) {
		case 'sync':
			return syncSummaryValue([sync.qualityProfiles, sync.delayProfiles, sync.mediaManagement]);
		case 'qualityProfileSync':
			return sectionValue(sync.qualityProfiles);
		case 'delayProfileSync':
			return sectionValue(sync.delayProfiles);
		case 'mediaManagementSync':
			return sectionValue(sync.mediaManagement);
		case 'drift':
			return driftValue(drift);
		case 'upgrades':
			return jobValue(
				instance.upgradeEnabled,
				upgrades.nextAt,
				upgrades.lastSearched !== null ? count(upgrades.lastSearched, 'Search', 'Searches') : null,
				upgrades.lastFailed
			);
		case 'renames':
			return jobValue(
				instance.renameEnabled,
				renames.nextAt,
				renames.lastRenamed !== null
					? count(renames.lastRenamed, 'File Renamed', 'Files Renamed')
					: null,
				false
			);
		case 'cleanup':
			return jobValue(
				instance.cleanupEnabled,
				cleanup.nextAt,
				cleanup.lastRemoved !== null ? `${cleanup.lastRemoved.toLocaleString()} Removed` : null,
				cleanup.lastFailed
			);
		case 'library':
			return library.total === null
				? { value: 'Not Counted', tone: 'muted', nextAt: library.nextAt }
				: { value: count(library.total, 'Item', 'Items'), tone: 'default', nextAt: library.nextAt };
	}
}

/** The visible rows for one card, in card order. */
export function getCardLines(instance: ArrInstanceSummary, visible: readonly string[]): CardLine[] {
	return ARR_CARD_ROWS.filter((row) => visible.includes(row.key)).map((row) => ({
		key: row.key,
		label: row.label,
		icon: row.icon,
		...rowValue(row.key, instance)
	}));
}
