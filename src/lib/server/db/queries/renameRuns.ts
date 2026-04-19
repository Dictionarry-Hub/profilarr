import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';
import type { RenameJobLog } from '$lib/server/rename/types.ts';

/**
 * Database row type for rename_runs table
 */
interface RenameRunRow {
	id: string;
	instance_id: number;
	started_at: string;
	completed_at: string;
	status: string;
	dry_run: number;
	manual: number;
	rename_folders: number;
	ignore_tag: string | null;
	library_total: number;
	library_fetch_ms: number;
	after_ignore_tag: number;
	skipped_by_tag: number;
	files_needing_rename: number;
	files_renamed: number;
	folders_renamed: number;
	commands_triggered: number;
	commands_completed: number;
	commands_failed: number;
	items: string;
	errors: string;
	created_at: string;
}

/**
 * Renamed item stored in the database
 */
interface RenamedItemRow {
	id: number;
	title: string;
	folder?: { existingPath: string; newPath: string };
	files: { existingPath: string; newPath: string }[];
}

/**
 * Convert database row to RenameJobLog format
 */
function rowToLog(row: RenameRunRow): RenameJobLog {
	return {
		id: row.id,
		instanceId: row.instance_id,
		instanceName: '', // Not stored, can be joined if needed
		instanceType: 'radarr', // Not stored, default
		startedAt: toUTC(row.started_at)!,
		completedAt: toUTC(row.completed_at)!,
		status: row.status as 'success' | 'partial' | 'failed' | 'skipped',

		config: {
			dryRun: row.dry_run === 1,
			renameFolders: row.rename_folders === 1,
			ignoreTag: row.ignore_tag,
			manual: row.manual === 1
		},

		library: {
			totalItems: row.library_total,
			fetchDurationMs: row.library_fetch_ms
		},

		filtering: {
			afterIgnoreTag: row.after_ignore_tag,
			skippedByTag: row.skipped_by_tag
		},

		results: {
			filesNeedingRename: row.files_needing_rename,
			filesRenamed: row.files_renamed,
			foldersRenamed: row.folders_renamed,
			commandsTriggered: row.commands_triggered,
			commandsCompleted: row.commands_completed,
			commandsFailed: row.commands_failed,
			errors: JSON.parse(row.errors) as string[]
		},

		renamedItems: JSON.parse(row.items) as RenamedItemRow[]
	};
}

/**
 * All queries for rename_runs table
 */
export const renameRunsQueries = {
	/**
	 * Insert a new rename run
	 */
	insert(log: RenameJobLog): void {
		db.execute(
			`INSERT INTO rename_runs (
				id, instance_id, started_at, completed_at, status, dry_run, manual,
				rename_folders, ignore_tag,
				library_total, library_fetch_ms,
				after_ignore_tag, skipped_by_tag,
				files_needing_rename, files_renamed, folders_renamed,
				commands_triggered, commands_completed, commands_failed,
				items, errors
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			log.id,
			log.instanceId,
			log.startedAt,
			log.completedAt,
			log.status,
			log.config.dryRun ? 1 : 0,
			log.config.manual ? 1 : 0,
			log.config.renameFolders ? 1 : 0,
			log.config.ignoreTag,
			log.library.totalItems,
			log.library.fetchDurationMs,
			log.filtering.afterIgnoreTag,
			log.filtering.skippedByTag,
			log.results.filesNeedingRename,
			log.results.filesRenamed,
			log.results.foldersRenamed,
			log.results.commandsTriggered,
			log.results.commandsCompleted,
			log.results.commandsFailed,
			JSON.stringify(log.renamedItems),
			JSON.stringify(log.results.errors)
		);
	},

	/**
	 * Get all rename runs for an instance, newest first
	 */
	getByInstanceId(instanceId: number, limit = 100): RenameJobLog[] {
		const rows = db.query<RenameRunRow>(
			`SELECT * FROM rename_runs
			WHERE instance_id = ?
			ORDER BY started_at DESC
			LIMIT ?`,
			instanceId,
			limit
		);
		return rows.map(rowToLog);
	},

	/**
	 * Get a single rename run by ID
	 */
	getById(id: string): RenameJobLog | undefined {
		const row = db.queryFirst<RenameRunRow>('SELECT * FROM rename_runs WHERE id = ?', id);
		return row ? rowToLog(row) : undefined;
	},

	/**
	 * Get recent runs across all instances
	 */
	getRecent(limit = 50): RenameJobLog[] {
		const rows = db.query<RenameRunRow>(
			`SELECT * FROM rename_runs
			ORDER BY started_at DESC
			LIMIT ?`,
			limit
		);
		return rows.map(rowToLog);
	},

	/**
	 * Get runs by status for an instance
	 */
	getByStatus(instanceId: number, status: string, limit = 50): RenameJobLog[] {
		const rows = db.query<RenameRunRow>(
			`SELECT * FROM rename_runs
			WHERE instance_id = ? AND status = ?
			ORDER BY started_at DESC
			LIMIT ?`,
			instanceId,
			status,
			limit
		);
		return rows.map(rowToLog);
	},

	/**
	 * Delete old runs (for retention policy)
	 * Returns number of rows deleted
	 */
	deleteOlderThan(days: number): number {
		return db.execute(
			`DELETE FROM rename_runs
			WHERE datetime(started_at) < datetime('now', '-' || ? || ' days')`,
			days
		);
	},

	/**
	 * Delete all runs for an instance
	 */
	deleteByInstanceId(instanceId: number): number {
		return db.execute('DELETE FROM rename_runs WHERE instance_id = ?', instanceId);
	},

	/**
	 * Get count of runs for an instance
	 */
	getCount(instanceId: number): number {
		const result = db.queryFirst<{ count: number }>(
			'SELECT COUNT(*) as count FROM rename_runs WHERE instance_id = ?',
			instanceId
		);
		return result?.count ?? 0;
	},

	/**
	 * Get stats summary for an instance
	 */
	getStats(instanceId: number): {
		totalRuns: number;
		successfulRuns: number;
		failedRuns: number;
		totalFilesRenamed: number;
		totalFoldersRenamed: number;
	} {
		const result = db.queryFirst<{
			total_runs: number;
			successful_runs: number;
			failed_runs: number;
			total_files_renamed: number;
			total_folders_renamed: number;
		}>(
			`SELECT
				COUNT(*) as total_runs,
				SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
				SUM(files_renamed) as total_files_renamed,
				SUM(folders_renamed) as total_folders_renamed
			FROM rename_runs
			WHERE instance_id = ?`,
			instanceId
		);

		return {
			totalRuns: result?.total_runs ?? 0,
			successfulRuns: result?.successful_runs ?? 0,
			failedRuns: result?.failed_runs ?? 0,
			totalFilesRenamed: result?.total_files_renamed ?? 0,
			totalFoldersRenamed: result?.total_folders_renamed ?? 0
		};
	}
};
