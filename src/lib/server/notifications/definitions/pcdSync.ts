/**
 * PCD sync notification definitions
 */

import type { Notification, NotificationBlock } from '../types.ts';

export interface PcdUpdatesAvailableParams {
	name: string;
	commitsBehind: number;
	commitMessages: string[];
}

export interface PcdSyncSuccessParams {
	name: string;
	commitsPulled: number;
	commitMessages: string[];
	schemaUpdate?: { from: string; to: string };
}

export interface PcdSyncFailedParams {
	name: string;
	error: string;
}

function buildChangesBlock(commitMessages: string[]): NotificationBlock | null {
	if (commitMessages.length === 0) return null;
	return {
		kind: 'section',
		title: 'Changes',
		content: commitMessages.map((m) => `• ${m}`).join('\n')
	};
}

export function pcdUpdatesAvailable(params: PcdUpdatesAvailableParams): Notification {
	const { name, commitsBehind, commitMessages } = params;
	const blocks: NotificationBlock[] = [];

	const changesBlock = buildChangesBlock(commitMessages);
	if (changesBlock) blocks.push(changesBlock);

	return {
		type: 'pcd.updates_available',
		severity: 'info',
		title: `Updates Available \u2013 ${name}`,
		message: `${commitsBehind} update(s) available`,
		blocks
	};
}

export function pcdSyncSuccess(params: PcdSyncSuccessParams): Notification {
	const { name, commitsPulled, commitMessages, schemaUpdate } = params;
	const blocks: NotificationBlock[] = [];

	const changesBlock = buildChangesBlock(commitMessages);
	if (changesBlock) blocks.push(changesBlock);

	if (schemaUpdate) {
		blocks.push({
			kind: 'section',
			title: 'Schema Updated',
			content: `${schemaUpdate.from} \u2192 ${schemaUpdate.to}`
		});
	}

	return {
		type: 'pcd.sync_success',
		severity: 'success',
		title: `Database Synced \u2013 ${name}`,
		message: `Pulled ${commitsPulled} update(s)`,
		blocks
	};
}

export function pcdSyncFailed(params: PcdSyncFailedParams): Notification {
	const { name, error } = params;

	return {
		type: 'pcd.sync_failed',
		severity: 'error',
		title: `Database Sync Failed \u2013 ${name}`,
		message: error,
		blocks: []
	};
}
