/**
 * Backup notification definitions
 */

import type { Notification, NotificationBlock } from '../types.ts';

export interface BackupSuccessParams {
	filename: string;
	sizeBytes: number;
	durationMs?: number;
}

export interface BackupFailedParams {
	error: string;
}

function formatSize(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function formatDuration(ms: number): string {
	if (ms < 1000) return `${ms}ms`;
	const totalSeconds = ms / 1000;
	if (totalSeconds < 60) return `${totalSeconds.toFixed(1)}s`;
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = Math.round(totalSeconds - minutes * 60);
	return `${minutes}m ${seconds}s`;
}

function firstLine(text: string): string {
	const idx = text.indexOf('\n');
	return idx === -1 ? text : text.slice(0, idx);
}

export function backupSuccess(params: BackupSuccessParams): Notification {
	const { filename, sizeBytes, durationMs } = params;

	const blocks: NotificationBlock[] = [
		{ kind: 'field', label: 'Size', value: formatSize(sizeBytes), inline: true }
	];

	if (durationMs !== undefined) {
		blocks.push({
			kind: 'field',
			label: 'Duration',
			value: formatDuration(durationMs),
			inline: true
		});
	}

	return {
		type: 'backup.success',
		severity: 'success',
		title: 'Backup Created',
		message: filename,
		messageFormat: 'code',
		blocks
	};
}

export function backupFailed(params: BackupFailedParams): Notification {
	const { error } = params;

	return {
		type: 'backup.failed',
		severity: 'error',
		title: 'Backup Failed',
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
