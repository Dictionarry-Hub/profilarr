/**
 * Arr cleanup notification definition
 */

import type { Notification, NotificationBlock, SectionItem } from '../types.ts';
import type { StaleItem } from '$sync/cleanup.ts';
import type { RemovedEntity } from '$sync/entityCleanup.ts';

export interface ArrCleanupNotificationParams {
	instanceName: string;
	instanceType: 'radarr' | 'sonarr';
	deletedCustomFormats: StaleItem[];
	deletedQualityProfiles: StaleItem[];
	skippedQualityProfiles: { item: StaleItem; reason: string }[];
	deletedEntities: RemovedEntity[];
	failedEntities: { entity: RemovedEntity; reason: string }[];
	/** Set ONLY when the handler's outer try/catch fires. Forces status=failed. */
	error?: string;
}

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatInstanceType(type: string): string {
	return capitalize(type);
}

function entityLabel(instanceType: 'radarr' | 'sonarr'): string {
	return instanceType === 'radarr' ? 'Movies' : 'Series';
}

function firstLine(text: string): string {
	const idx = text.indexOf('\n');
	return idx === -1 ? text : text.slice(0, idx);
}

function groupByReason(pairs: { reason: string; name: string }[]): SectionItem[] {
	const groups = new Map<string, string[]>();
	for (const p of pairs) {
		const list = groups.get(p.reason) ?? [];
		list.push(p.name);
		groups.set(p.reason, list);
	}
	return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

export function arrCleanup(params: ArrCleanupNotificationParams): Notification {
	const {
		instanceName,
		instanceType,
		deletedCustomFormats,
		deletedQualityProfiles,
		skippedQualityProfiles,
		deletedEntities,
		failedEntities,
		error
	} = params;

	const displayType = formatInstanceType(instanceType);
	const instanceLabel = `${displayType} (${instanceName})`;
	const eLabel = entityLabel(instanceType);

	const deletedConfigsCount = deletedCustomFormats.length + deletedQualityProfiles.length;
	const totalDeleted = deletedConfigsCount + deletedEntities.length;
	const totalNonSuccess = skippedQualityProfiles.length + failedEntities.length;

	let status: 'success' | 'partial' | 'failed';
	let severity: 'success' | 'warning' | 'error';
	let titleStatus: string;

	if (error !== undefined) {
		status = 'failed';
		severity = 'error';
		titleStatus = 'Failed';
	} else if (totalNonSuccess === 0 && totalDeleted > 0) {
		status = 'success';
		severity = 'success';
		titleStatus = 'Complete';
	} else if (totalNonSuccess > 0 && totalDeleted > 0) {
		status = 'partial';
		severity = 'warning';
		titleStatus = 'Partial';
	} else {
		status = 'failed';
		severity = 'error';
		titleStatus = 'Failed';
	}

	const title = `Cleanup ${titleStatus} – ${instanceLabel}`;

	let message: string;
	if (error !== undefined) {
		message = firstLine(error);
	} else if (status === 'success') {
		const noun = totalDeleted === 1 ? 'item' : 'items';
		message = `Deleted ${totalDeleted} ${noun}`;
	} else if (status === 'partial') {
		message = `Deleted ${totalDeleted}, ${totalNonSuccess} not deleted`;
	} else {
		const noun = totalNonSuccess === 1 ? 'item' : 'items';
		message = `Could not delete ${totalNonSuccess} ${noun}`;
	}

	const blocks: NotificationBlock[] = [];

	// Hard failure: full error text in a section so Discord renders it as a code block with an
	// "Error" label. Summary tier drops the section and shows firstLine(error) via message.
	if (error !== undefined) {
		blocks.push({
			kind: 'section',
			title: 'Error',
			content: error
		});
		return { type: `arr.cleanup.${status}`, severity, title, message, blocks };
	}

	const deletedGroups: SectionItem[] = [];
	if (deletedQualityProfiles.length > 0) {
		deletedGroups.push({
			label: 'Profiles',
			items: deletedQualityProfiles.map((p) => p.name)
		});
	}
	if (deletedCustomFormats.length > 0) {
		deletedGroups.push({
			label: 'Formats',
			items: deletedCustomFormats.map((f) => f.name)
		});
	}
	if (deletedEntities.length > 0) {
		deletedGroups.push({
			label: eLabel,
			items: deletedEntities.map((e) => e.title)
		});
	}
	if (deletedGroups.length > 0) {
		blocks.push({
			kind: 'section',
			title: 'Deleted',
			content: '',
			items: deletedGroups
		});
	}

	if (skippedQualityProfiles.length > 0) {
		blocks.push({
			kind: 'section',
			title: 'Skipped Profiles',
			content: '',
			items: groupByReason(
				skippedQualityProfiles.map((s) => ({ reason: s.reason, name: s.item.name }))
			)
		});
	}

	if (failedEntities.length > 0) {
		blocks.push({
			kind: 'section',
			title: `Failed ${eLabel}`,
			content: '',
			items: groupByReason(failedEntities.map((f) => ({ reason: f.reason, name: f.entity.title })))
		});
	}

	return { type: `arr.cleanup.${status}`, severity, title, message, blocks };
}
