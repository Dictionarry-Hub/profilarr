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
 * Build a short per-section summary line for the message field.
 * e.g. "Quality Profiles: 12 updated · 3 created"
 */
function buildSectionSummaryLine(section: ArrSyncSectionResult): string {
	const label = getSectionLabel(section.section);

	if (!section.success) {
		return `${label}: Failed – ${section.error ?? 'Unknown error'}`;
	}

	if (!section.items || section.items.length === 0) {
		return `${label}: no changes`;
	}

	const created = section.items.filter((i) => i.action === 'created').length;
	const updated = section.items.filter((i) => i.action === 'updated').length;

	const parts: string[] = [];
	if (updated > 0) parts.push(`${updated} updated`);
	if (created > 0) parts.push(`${created} created`);

	return `${label}: ${parts.join(' · ')}`;
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

	const message = sections.map(buildSectionSummaryLine).join('\n');

	const blocks: NotificationBlock[] = [];

	for (const section of sections) {
		// Only emit blocks for sections with actual items to list.
		// "no changes" and "failed" sections are covered by the message.
		if (section.success && section.items && section.items.length > 0) {
			blocks.push({
				kind: 'section',
				title: getSectionLabel(section.section),
				content: '',
				items: groupByAction(section.items)
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
