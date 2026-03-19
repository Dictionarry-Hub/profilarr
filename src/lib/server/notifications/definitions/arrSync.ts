/**
 * Arr sync notification definition
 */

import type { Notification, NotificationBlock, SectionItem } from '../types.ts';
import type { SyncedItem } from '$lib/server/sync/types.ts';

export interface ArrSyncSectionResult {
	section: string;
	success: boolean;
	items?: SyncedItem[];
	error?: string;
}

export interface ArrSyncNotificationParams {
	instanceName: string;
	instanceType: string;
	sections: ArrSyncSectionResult[];
}

const sectionLabels: Record<string, string> = {
	qualityProfiles: 'Quality Profiles',
	delayProfiles: 'Delay Profiles',
	mediaManagement: 'Media Management'
};

function getSectionLabel(section: string): string {
	return sectionLabels[section] ?? section;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatInstanceType(type: string): string {
	return capitalize(type);
}

/**
 * Build the content summary for a successful section.
 * e.g. "15 items (12 updated · 3 created)"
 */
function buildContentSummary(items: SyncedItem[]): string {
	const total = items.length;
	const created = items.filter((i) => i.action === 'created').length;
	const updated = items.filter((i) => i.action === 'updated').length;

	const parts: string[] = [];
	if (created > 0) parts.push(`${created} created`);
	if (updated > 0) parts.push(`${updated} updated`);

	const itemWord = total === 1 ? 'item' : 'items';
	return parts.length > 0 ? `${total} ${itemWord} (${parts.join(' · ')})` : `${total} ${itemWord}`;
}

/**
 * Group synced items by action into SectionItem arrays.
 * Only includes groups that have items (e.g. omits "created" if nothing was created).
 */
function groupByAction(items: SyncedItem[]): SectionItem[] {
	const groups: SectionItem[] = [];

	const created = items.filter((i) => i.action === 'created').map((i) => i.name);
	const updated = items.filter((i) => i.action === 'updated').map((i) => i.name);

	if (created.length > 0) groups.push({ label: 'created', items: created });
	if (updated.length > 0) groups.push({ label: 'updated', items: updated });

	return groups;
}

export function arrSync(params: ArrSyncNotificationParams): Notification {
	const { instanceName, instanceType, sections } = params;
	const displayType = formatInstanceType(instanceType);
	const instanceLabel = `${displayType} (${instanceName})`;

	const successes = sections.filter((s) => s.success).length;
	const failures = sections.filter((s) => !s.success).length;
	const total = sections.length;

	let status: 'success' | 'partial' | 'failed';
	let severity: 'success' | 'warning' | 'error';
	let titleStatus: string;

	if (failures === 0) {
		status = 'success';
		severity = 'success';
		titleStatus = 'Complete';
	} else if (successes > 0) {
		status = 'partial';
		severity = 'warning';
		titleStatus = 'Partial';
	} else {
		status = 'failed';
		severity = 'error';
		titleStatus = 'Failed';
	}

	const title = `Sync ${titleStatus} – ${instanceLabel}`;

	let message: string;
	if (status === 'failed') {
		message = `All sections failed for ${instanceLabel}`;
	} else if (status === 'partial') {
		message = `${successes} of ${total} sections synced to ${instanceLabel}`;
	} else {
		message = `Synced ${total} ${total === 1 ? 'section' : 'sections'} to ${instanceLabel}`;
	}

	const blocks: NotificationBlock[] = [];

	for (const section of sections) {
		const label = getSectionLabel(section.section);

		if (section.success && section.items && section.items.length > 0) {
			blocks.push({
				kind: 'section',
				title: label,
				content: buildContentSummary(section.items),
				items: groupByAction(section.items)
			});
		} else if (section.success) {
			blocks.push({
				kind: 'section',
				title: label,
				content: '0 changes'
			});
		} else {
			blocks.push({
				kind: 'section',
				title: label,
				content: `Failed – ${section.error ?? 'Unknown error'}`
			});
		}
	}

	return {
		type: `arr.sync.${status}`,
		severity,
		title,
		message,
		blocks
	};
}
