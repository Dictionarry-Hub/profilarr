// Rows on the Arr card. Left of the dot: what the job is or did last.
// Right of the dot (muted): when it runs next.
import Sliders from '@lucide/svelte/icons/sliders-vertical';
import Clock from '@lucide/svelte/icons/clock';
import Tag from '@lucide/svelte/icons/tag';
import ArrowLeftRight from '@lucide/svelte/icons/arrow-left-right';
import ArrowUpCircle from '@lucide/svelte/icons/circle-arrow-up';
import FileEdit from '@lucide/svelte/icons/file-pen';
import Trash2 from '@lucide/svelte/icons/trash';
import Library from '@lucide/svelte/icons/library';
import type { Component } from 'svelte';
import type { ArrInstanceSummary, SectionActivity } from '#routes/arr/+page.server.ts';

export type LineTone = 'default' | 'muted' | 'ok' | 'warn' | 'danger';

export interface CardLine {
	label: string;
	icon: Component;
	value: string;
	tone: LineTone;
	/** Show a check before the value. */
	check?: boolean;
	/** When the job runs next, shown muted after the dot. */
	nextAt?: string | null;
}

export const lineToneClass: Record<LineTone, string> = {
	default: 'text-neutral-900 dark:text-neutral-100',
	muted: 'text-neutral-400 dark:text-neutral-500',
	ok: 'text-emerald-600 dark:text-emerald-400',
	warn: 'text-amber-600 dark:text-amber-400',
	danger: 'text-red-600 dark:text-red-400'
};

const count = (n: number, one: string, many: string) =>
	`${n.toLocaleString()} ${n === 1 ? one : many}`;

function syncLine(label: string, icon: Component, section: SectionActivity): CardLine {
	const base = { label, icon };
	if (!section.configured) return { ...base, value: 'Not Set Up', tone: 'muted' };
	if (section.status === 'in_progress') return { ...base, value: 'Syncing', tone: 'ok' };
	const nextAt = section.nextAt;
	if (section.status === 'failed') return { ...base, value: 'Failed', tone: 'danger', nextAt };
	const value =
		section.trigger === 'schedule'
			? 'Scheduled'
			: section.trigger === 'on_pull'
				? 'On Pull'
				: 'Manual';
	return { ...base, value, tone: 'default', nextAt };
}

function driftLine(instance: ArrInstanceSummary): CardLine {
	const { status, count: differences, nextAt } = instance.activity.drift;
	const base = { label: 'Drift', icon: ArrowLeftRight, nextAt };
	if (status === 'drift_detected')
		return { ...base, value: count(differences, 'Difference', 'Differences'), tone: 'warn' };
	if (status === 'clean') return { ...base, value: 'In Sync', tone: 'ok', check: true };
	if (status === 'failed') return { ...base, value: 'Failed', tone: 'danger' };
	return { ...base, value: 'Not Checked', tone: 'muted' };
}

function jobLine(
	label: string,
	icon: Component,
	enabled: boolean,
	nextAt: string | null,
	lastResult: string | null,
	lastFailed: boolean
): CardLine {
	if (!enabled) return { label, icon, value: 'Off', tone: 'muted' };
	if (lastFailed) return { label, icon, value: 'Failed', tone: 'danger', nextAt };
	return {
		label,
		icon,
		value: lastResult ?? 'Not Run Yet',
		tone: lastResult ? 'default' : 'muted',
		nextAt
	};
}

export function getCardLines(instance: ArrInstanceSummary): CardLine[] {
	const { sync, upgrades, renames, cleanup, library } = instance.activity;
	return [
		syncLine('Quality Profile Sync', Sliders, sync.qualityProfiles),
		syncLine('Delay Profile Sync', Clock, sync.delayProfiles),
		syncLine('Media Management Sync', Tag, sync.mediaManagement),
		driftLine(instance),
		jobLine(
			'Upgrades',
			ArrowUpCircle,
			instance.upgradeEnabled,
			upgrades.nextAt,
			upgrades.lastSearched !== null ? count(upgrades.lastSearched, 'Search', 'Searches') : null,
			upgrades.lastFailed
		),
		jobLine(
			'Renames',
			FileEdit,
			instance.renameEnabled,
			renames.nextAt,
			renames.lastRenamed !== null
				? count(renames.lastRenamed, 'File Renamed', 'Files Renamed')
				: null,
			false
		),
		jobLine(
			'Cleanup',
			Trash2,
			instance.cleanupEnabled,
			cleanup.nextAt,
			cleanup.lastRemoved !== null ? `${cleanup.lastRemoved.toLocaleString()} Removed` : null,
			cleanup.lastFailed
		),
		library.total === null
			? {
					label: 'Library',
					icon: Library,
					value: 'Not Counted',
					tone: 'muted',
					nextAt: library.nextAt
				}
			: {
					label: 'Library',
					icon: Library,
					value: count(library.total, 'Item', 'Items'),
					tone: 'default',
					nextAt: library.nextAt
				}
	];
}
