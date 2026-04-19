import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';
import type { FilterConfig, FilterMode, UpgradeConfig } from '$shared/upgrades/filters.ts';

/**
 * Database row type for upgrade_configs table
 */
interface UpgradeConfigRow {
	id: number;
	arr_instance_id: number;
	enabled: number;
	cron: string;
	next_run_at: string | null;
	filter_mode: string;
	filters: string;
	current_filter_index: number;
	last_run_at: string | null;
	created_at: string;
	updated_at: string;
}

/**
 * Input for creating/updating an upgrade config
 */
export interface UpgradeConfigInput {
	enabled?: boolean;
	cron?: string;
	filterMode?: FilterMode;
	filters?: FilterConfig[];
	currentFilterIndex?: number;
}

/**
 * Convert database row to UpgradeConfig
 */
function rowToConfig(row: UpgradeConfigRow): UpgradeConfig {
	return {
		id: row.id,
		arrInstanceId: row.arr_instance_id,
		enabled: row.enabled === 1,
		cron: row.cron,
		nextRunAt: toUTC(row.next_run_at),
		filterMode: row.filter_mode as FilterMode,
		filters: JSON.parse(row.filters) as FilterConfig[],
		currentFilterIndex: row.current_filter_index,
		lastRunAt: toUTC(row.last_run_at),
		createdAt: toUTC(row.created_at) ?? undefined,
		updatedAt: toUTC(row.updated_at) ?? undefined
	};
}

/**
 * All queries for upgrade_configs table
 */
export const upgradeConfigsQueries = {
	/**
	 * Get upgrade config by arr instance ID
	 */
	getByArrInstanceId(arrInstanceId: number): UpgradeConfig | undefined {
		const row = db.queryFirst<UpgradeConfigRow>(
			'SELECT * FROM upgrade_configs WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return row ? rowToConfig(row) : undefined;
	},

	/**
	 * Get all upgrade configs
	 */
	getAll(): UpgradeConfig[] {
		const rows = db.query<UpgradeConfigRow>('SELECT * FROM upgrade_configs');
		return rows.map(rowToConfig);
	},

	/**
	 * Get all enabled upgrade configs
	 */
	getEnabled(): UpgradeConfig[] {
		const rows = db.query<UpgradeConfigRow>('SELECT * FROM upgrade_configs WHERE enabled = 1');
		return rows.map(rowToConfig);
	},

	/**
	 * Create or update an upgrade config for an arr instance
	 * Uses upsert pattern since there's one config per instance
	 */
	upsert(arrInstanceId: number, input: UpgradeConfigInput): UpgradeConfig {
		const existing = this.getByArrInstanceId(arrInstanceId);

		if (existing) {
			// Update existing
			this.update(arrInstanceId, input);
			return this.getByArrInstanceId(arrInstanceId)!;
		}

		// Create new
		const enabled = input.enabled !== undefined ? (input.enabled ? 1 : 0) : 0;
		const cron = input.cron ?? '0 */6 * * *';
		const filterMode = input.filterMode ?? 'round_robin';
		const filters = JSON.stringify(input.filters ?? []);
		const currentFilterIndex = input.currentFilterIndex ?? 0;

		db.execute(
			`INSERT INTO upgrade_configs
			(arr_instance_id, enabled, cron, filter_mode, filters, current_filter_index)
			VALUES (?, ?, ?, ?, ?, ?)`,
			arrInstanceId,
			enabled,
			cron,
			filterMode,
			filters,
			currentFilterIndex
		);

		return this.getByArrInstanceId(arrInstanceId)!;
	},

	/**
	 * Update an upgrade config
	 */
	update(arrInstanceId: number, input: UpgradeConfigInput): boolean {
		const updates: string[] = [];
		const params: (string | number)[] = [];

		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.cron !== undefined) {
			updates.push('cron = ?');
			params.push(input.cron);
		}
		if (input.filterMode !== undefined) {
			updates.push('filter_mode = ?');
			params.push(input.filterMode);
		}
		if (input.filters !== undefined) {
			updates.push('filters = ?');
			params.push(JSON.stringify(input.filters));
		}
		if (input.currentFilterIndex !== undefined) {
			updates.push('current_filter_index = ?');
			params.push(input.currentFilterIndex);
		}

		if (updates.length === 0) {
			return false;
		}

		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(arrInstanceId);

		const affected = db.execute(
			`UPDATE upgrade_configs SET ${updates.join(', ')} WHERE arr_instance_id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Delete an upgrade config
	 */
	delete(arrInstanceId: number): boolean {
		const affected = db.execute(
			'DELETE FROM upgrade_configs WHERE arr_instance_id = ?',
			arrInstanceId
		);
		return affected > 0;
	},

	/**
	 * Increment the current filter index (for round-robin mode)
	 * Wraps around to 0 when reaching the end
	 */
	incrementFilterIndex(arrInstanceId: number): number {
		const config = this.getByArrInstanceId(arrInstanceId);
		if (!config) return 0;

		const enabledFilters = config.filters.filter((f) => f.enabled);
		if (enabledFilters.length === 0) return 0;

		const nextIndex = (config.currentFilterIndex + 1) % enabledFilters.length;

		db.execute(
			'UPDATE upgrade_configs SET current_filter_index = ?, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			nextIndex,
			arrInstanceId
		);

		return nextIndex;
	},

	/**
	 * Reset the filter index to 0
	 */
	resetFilterIndex(arrInstanceId: number): void {
		db.execute(
			'UPDATE upgrade_configs SET current_filter_index = 0, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			arrInstanceId
		);
	},

	/**
	 * Update last_run_at to current timestamp
	 */
	updateLastRun(arrInstanceId: number): void {
		db.execute(
			'UPDATE upgrade_configs SET last_run_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			arrInstanceId
		);
	},

	/**
	 * Update next_run_at
	 */
	updateNextRunAt(arrInstanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE upgrade_configs SET next_run_at = ?, updated_at = CURRENT_TIMESTAMP WHERE arr_instance_id = ?',
			nextRunAt,
			arrInstanceId
		);
	},

	/**
	 * Get all enabled configs that are due to run
	 * A config is due if: next_run_at is null OR now >= next_run_at
	 */
	getDueConfigs(): UpgradeConfig[] {
		const rows = db.query<UpgradeConfigRow>(`
			SELECT * FROM upgrade_configs
			WHERE enabled = 1
			AND (
				next_run_at IS NULL
				OR datetime('now') >= datetime(replace(replace(next_run_at, 'T', ' '), 'Z', ''))
			)
		`);
		return rows.map(rowToConfig);
	}
};
