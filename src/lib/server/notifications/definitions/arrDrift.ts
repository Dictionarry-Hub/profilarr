import type { Notification, NotificationBlock } from '../types.ts';
import type { DriftDisplayEntity } from '$shared/drift.ts';

export interface ArrDriftDetectedNotificationParams {
	instanceName: string;
	instanceType: string;
	entities: DriftDisplayEntity[];
	maxEntities?: number;
}

export interface ArrDriftFailedNotificationParams {
	instanceName: string;
	instanceType: string;
	error: string;
}

const DEFAULT_MAX_ENTITIES = 15;

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatInstanceType(type: string): string {
	return capitalize(type);
}

function instanceLabel(instanceType: string, instanceName: string): string {
	return `${formatInstanceType(instanceType)} (${instanceName})`;
}

function firstLine(text: string): string {
	const idx = text.indexOf('\n');
	return idx === -1 ? text : text.slice(0, idx);
}

function buildDriftedItemBlocks(
	entities: DriftDisplayEntity[],
	maxEntities: number
): NotificationBlock[] {
	const shown = entities.slice(0, maxEntities);
	const remaining = entities.length - shown.length;
	const groups = new Map<string, DriftDisplayEntity[]>();

	for (const entity of shown) {
		const group = groups.get(entity.sectionLabel) ?? [];
		group.push(entity);
		groups.set(entity.sectionLabel, group);
	}

	const blocks: NotificationBlock[] = [];
	for (const [label, group] of groups) {
		blocks.push({
			kind: 'section',
			title: label,
			content: group
				.map((entity) => {
					const db = entity.databaseName ? ` (${entity.databaseName})` : '';
					return `- ${entity.title}${db}: ${entity.summary}`;
				})
				.join('\n')
		});
	}

	if (remaining > 0) {
		blocks.push({
			kind: 'section',
			title: 'More',
			content: `+${remaining} more`
		});
	}

	return blocks;
}

export function arrDriftDetected(params: ArrDriftDetectedNotificationParams): Notification {
	const { instanceName, instanceType, entities } = params;
	const maxEntities = params.maxEntities ?? DEFAULT_MAX_ENTITIES;

	return {
		type: 'arr.drift.detected',
		severity: 'warning',
		title: `Drift Detected - ${instanceLabel(instanceType, instanceName)}`,
		message: '',
		blocks: buildDriftedItemBlocks(entities, maxEntities)
	};
}

export function arrDriftFailed(params: ArrDriftFailedNotificationParams): Notification {
	const { instanceName, instanceType, error } = params;

	return {
		type: 'arr.drift.failed',
		severity: 'error',
		title: `Drift Check Failed - ${instanceLabel(instanceType, instanceName)}`,
		message: firstLine(error),
		blocks: [
			{
				kind: 'section',
				title: 'Error',
				content: error
			}
		]
	};
}
