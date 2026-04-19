import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';
import type { UpgradeJobLog, UpgradeSelectionItem } from '$lib/server/upgrades/types.ts';

/**
 * Database row type for upgrade_runs table
 */
interface UpgradeRunRow {
	id: string;
	instance_id: number;
	started_at: string;
	completed_at: string;
	status: string;
	dry_run: number;
	cron: string;
	filter_mode: string;
	filter_name: string;
	filter_id: string;
	library_total: number;
	library_cached: number;
	library_fetch_ms: number;
	matched_count: number;
	after_cooldown: number;
	dry_run_excluded: number;
	selection_method: string;
	selection_requested: number;
	selected_count: number;
	searches_triggered: number;
	successful: number;
	failed: number;
	items: string;
	errors: string;
	created_at: string;
}

/**
 * Convert database row to UpgradeJobLog format
 * This maintains backwards compatibility with existing UI components
 */
function rowToLog(row: UpgradeRunRow): UpgradeJobLog {
	return {
		id: row.id,
		configId: 0, // Not stored, not needed for display
		instanceId: row.instance_id,
		instanceName: '', // Not stored, can be joined if needed
		startedAt: toUTC(row.started_at),
		completedAt: toUTC(row.completed_at),
		status: row.status as 'success' | 'partial' | 'failed' | 'skipped',

		config: {
			cron: row.cron,
			filterMode: row.filter_mode,
			selectedFilter: row.filter_name,
			dryRun: row.dry_run === 1
		},

		library: {
			totalItems: row.library_total,
			fetchedFromCache: row.library_cached === 1,
			fetchDurationMs: row.library_fetch_ms
		},

		filter: {
			id: row.filter_id,
			name: row.filter_name,
			rules: { type: 'group', match: 'all', children: [] }, // Not stored, too complex
			matchedCount: row.matched_count,
			afterCooldown: row.after_cooldown,
			dryRunExcluded: row.dry_run_excluded
		},

		selection: {
			method: row.selection_method,
			requestedCount: row.selection_requested,
			actualCount: row.selected_count,
			items: JSON.parse(row.items) as UpgradeSelectionItem[]
		},

		results: {
			searchesTriggered: row.searches_triggered,
			successful: row.successful,
			failed: row.failed,
			errors: JSON.parse(row.errors) as string[]
		}
	};
}

/**
 * All queries for upgrade_runs table
 */
export const upgradeRunsQueries = {
	/**
	 * Insert a new upgrade run
	 */
	insert(log: UpgradeJobLog): void {
		db.execute(
			`INSERT INTO upgrade_runs (
				id, instance_id, started_at, completed_at, status, dry_run,
				cron, filter_mode, filter_name, filter_id,
				library_total, library_cached, library_fetch_ms,
				matched_count, after_cooldown, cooldown_hours, dry_run_excluded,
				selection_method, selection_requested, selected_count,
				searches_triggered, successful, failed,
				items, errors
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			log.id,
			log.instanceId,
			log.startedAt,
			log.completedAt,
			log.status,
			log.config.dryRun ? 1 : 0,
			log.config.cron,
			log.config.filterMode,
			log.config.selectedFilter,
			log.filter.id,
			log.library.totalItems,
			log.library.fetchedFromCache ? 1 : 0,
			log.library.fetchDurationMs,
			log.filter.matchedCount,
			log.filter.afterCooldown,
			0, // cooldown_hours deprecated, kept for backwards compatibility
			log.filter.dryRunExcluded,
			log.selection.method,
			log.selection.requestedCount,
			log.selection.actualCount,
			log.results.searchesTriggered,
			log.results.successful,
			log.results.failed,
			JSON.stringify(log.selection.items),
			JSON.stringify(log.results.errors)
		);
	},

	/**
	 * Get all upgrade runs for an instance, newest first
	 */
	getByInstanceId(instanceId: number, limit = 100): UpgradeJobLog[] {
		const rows = db.query<UpgradeRunRow>(
			`SELECT * FROM upgrade_runs
			WHERE instance_id = ?
			ORDER BY started_at DESC
			LIMIT ?`,
			instanceId,
			limit
		);
		return rows.map(rowToLog);
	},

	/**
	 * Get a single upgrade run by ID
	 */
	getById(id: string): UpgradeJobLog | undefined {
		const row = db.queryFirst<UpgradeRunRow>('SELECT * FROM upgrade_runs WHERE id = ?', id);
		return row ? rowToLog(row) : undefined;
	},

	/**
	 * Get recent runs across all instances
	 */
	getRecent(limit = 50): UpgradeJobLog[] {
		const rows = db.query<UpgradeRunRow>(
			`SELECT * FROM upgrade_runs
			ORDER BY started_at DESC
			LIMIT ?`,
			limit
		);
		return rows.map(rowToLog);
	},

	/**
	 * Get runs by status for an instance
	 */
	getByStatus(instanceId: number, status: string, limit = 50): UpgradeJobLog[] {
		const rows = db.query<UpgradeRunRow>(
			`SELECT * FROM upgrade_runs
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
			`DELETE FROM upgrade_runs
			WHERE datetime(started_at) < datetime('now', '-' || ? || ' days')`,
			days
		);
	},

	/**
	 * Delete all runs for an instance
	 */
	deleteByInstanceId(instanceId: number): number {
		return db.execute('DELETE FROM upgrade_runs WHERE instance_id = ?', instanceId);
	},

	/**
	 * Get count of runs for an instance
	 */
	getCount(instanceId: number): number {
		const result = db.queryFirst<{ count: number }>(
			'SELECT COUNT(*) as count FROM upgrade_runs WHERE instance_id = ?',
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
		totalSearches: number;
		totalUpgrades: number;
	} {
		const result = db.queryFirst<{
			total_runs: number;
			successful_runs: number;
			failed_runs: number;
			total_searches: number;
			total_upgrades: number;
		}>(
			`SELECT
				COUNT(*) as total_runs,
				SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful_runs,
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_runs,
				SUM(searches_triggered) as total_searches,
				SUM(successful) as total_upgrades
			FROM upgrade_runs
			WHERE instance_id = ?`,
			instanceId
		);

		return {
			totalRuns: result?.total_runs ?? 0,
			successfulRuns: result?.successful_runs ?? 0,
			failedRuns: result?.failed_runs ?? 0,
			totalSearches: result?.total_searches ?? 0,
			totalUpgrades: result?.total_upgrades ?? 0
		};
	}
};
