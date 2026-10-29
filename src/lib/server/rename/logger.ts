/**
 * Structured logging for rename jobs
 * Uses the shared logger with source 'RenameJob'
 * Stores run history in the database
 */

import { logger } from '#logger/logger.ts';
import { renameRunsQueries } from '#db/queries/renameRuns.ts';
import type { RenameJobLog } from './types.ts';

const SOURCE = 'RenameJob';

/**
 * Log a rename run with structured data
 */
export async function logRenameRun(log: RenameJobLog): Promise<void> {
	const duration = new Date(log.completedAt).getTime() - new Date(log.startedAt).getTime();

	const parts = ['rename'];
	if (log.config.dryRun) parts.unshift('dry run');
	if (log.config.manual) parts.unshift('manual');
	const mode = parts.join(' ');

	// A dry run renames nothing, so it reports what its previews found
	const counts = log.config.dryRun
		? `${log.results.filesNeedingRename} files would be renamed`
		: `${log.results.filesRenamed} files, ${log.results.foldersRenamed} folders renamed`;
	const summary = `Completed Job: ${mode} for "${log.instanceName}": ${counts} across ${log.renamedItems.length} entities (${duration}ms)`;

	await logger.info(summary, {
		source: SOURCE,
		meta: {
			instanceId: log.instanceId,
			status: log.status,
			dryRun: log.config.dryRun,
			manual: log.config.manual,
			filesRenamed: log.results.filesRenamed,
			foldersRenamed: log.results.foldersRenamed,
			entitiesChanged: log.renamedItems.length,
			durationMs: duration
		}
	});

	// Save full structured data to database
	try {
		renameRunsQueries.insert(log);
	} catch (err) {
		await logger.error(`Failed to save rename run to database: ${err}`, {
			source: SOURCE,
			meta: { runId: log.id, error: err }
		});
	}
}

/**
 * Log when a rename config is skipped
 */
export async function logRenameSkipped(
	instanceId: number,
	instanceName: string,
	reason: string
): Promise<void> {
	await logger.debug(`Skipped ${instanceName}: ${reason}`, {
		source: SOURCE,
		meta: { instanceId, reason }
	});
}

/**
 * Log errors during rename processing
 */
export async function logRenameError(
	instanceId: number,
	instanceName: string,
	error: string
): Promise<void> {
	await logger.error(`Rename failed for ${instanceName}: ${error}`, {
		source: SOURCE,
		meta: { instanceId, error }
	});
}
