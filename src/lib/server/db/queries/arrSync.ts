import { db } from '../db.ts';

// Types
export type SyncTrigger = 'manual' | 'on_pull' | 'schedule';

export interface ProfileSelection {
	databaseId: number;
	profileName: string;
}

export interface SyncConfig {
	trigger: SyncTrigger;
	cron: string | null;
	nextRunAt?: string | null;
}

export interface QualityProfilesSyncData {
	selections: ProfileSelection[];
	config: SyncConfig;
}

export interface DelayProfilesSyncData {
	databaseId: number | null;
	profileName: string | null;
	trigger: SyncTrigger;
	cron: string | null;
	nextRunAt?: string | null;
}

export interface MediaManagementSyncData {
	namingDatabaseId: number | null;
	namingConfigName: string | null;
	qualityDefinitionsDatabaseId: number | null;
	qualityDefinitionsConfigName: string | null;
	mediaSettingsDatabaseId: number | null;
	mediaSettingsConfigName: string | null;
	trigger: SyncTrigger;
	cron: string | null;
	nextRunAt?: string | null;
}

export interface SyncConfigStatus {
	trigger: SyncTrigger;
	cron: string | null;
	nextRunAt: string | null;
	syncStatus: string;
}

// Row types
interface ProfileSelectionRow {
	instance_id: number;
	database_id: number;
	profile_name: string;
}

interface ConfigRow {
	instance_id: number;
	trigger: string;
	cron: string | null;
}

interface ConfigStatusRow {
	trigger: string;
	cron: string | null;
	next_run_at: string | null;
	sync_status: string;
}

interface DelayProfileConfigRow {
	instance_id: number;
	database_id: number | null;
	profile_name: string | null;
	trigger: string;
	cron: string | null;
}

interface MediaManagementRow {
	instance_id: number;
	naming_database_id: number | null;
	naming_config_name: string | null;
	quality_definitions_database_id: number | null;
	quality_definitions_config_name: string | null;
	media_settings_database_id: number | null;
	media_settings_config_name: string | null;
	trigger: string;
	cron: string | null;
}

export const arrSyncQueries = {
	// ========== Quality Profiles ==========

	getQualityProfilesSync(instanceId: number): QualityProfilesSyncData {
		const selectionRows = db.query<ProfileSelectionRow>(
			'SELECT * FROM arr_sync_quality_profiles WHERE instance_id = ?',
			instanceId
		);

		const configRow = db.queryFirst<ConfigRow>(
			'SELECT * FROM arr_sync_quality_profiles_config WHERE instance_id = ?',
			instanceId
		);

		return {
			selections: selectionRows.map((row) => ({
				databaseId: row.database_id,
				profileName: row.profile_name
			})),
			config: {
				trigger: (configRow?.trigger as SyncTrigger) ?? 'manual',
				cron: configRow?.cron ?? null
			}
		};
	},

	saveQualityProfilesSync(
		instanceId: number,
		selections: ProfileSelection[],
		config: SyncConfig
	): void {
		// Clear existing selections
		db.execute('DELETE FROM arr_sync_quality_profiles WHERE instance_id = ?', instanceId);

		// Insert new selections
		for (const sel of selections) {
			db.execute(
				'INSERT INTO arr_sync_quality_profiles (instance_id, database_id, profile_name) VALUES (?, ?, ?)',
				instanceId,
				sel.databaseId,
				sel.profileName
			);
		}

		// Upsert config
		db.execute(
			`INSERT INTO arr_sync_quality_profiles_config (instance_id, trigger, cron, next_run_at)
			 VALUES (?, ?, ?, ?)
			 ON CONFLICT(instance_id) DO UPDATE SET trigger = ?, cron = ?, next_run_at = ?`,
			instanceId,
			config.trigger,
			config.cron,
			config.nextRunAt ?? null,
			config.trigger,
			config.cron,
			config.nextRunAt ?? null
		);
	},

	// ========== Delay Profiles ==========

	getDelayProfilesSync(instanceId: number): DelayProfilesSyncData {
		const row = db.queryFirst<DelayProfileConfigRow>(
			'SELECT * FROM arr_sync_delay_profiles_config WHERE instance_id = ?',
			instanceId
		);

		return {
			databaseId: row?.database_id ?? null,
			profileName: row?.profile_name ?? null,
			trigger: (row?.trigger as SyncTrigger) ?? 'manual',
			cron: row?.cron ?? null
		};
	},

	saveDelayProfilesSync(instanceId: number, data: DelayProfilesSyncData): void {
		db.execute(
			`INSERT INTO arr_sync_delay_profiles_config
			 (instance_id, database_id, profile_name, trigger, cron, next_run_at)
			 VALUES (?, ?, ?, ?, ?, ?)
			 ON CONFLICT(instance_id) DO UPDATE SET
			 database_id = ?,
			 profile_name = ?,
			 trigger = ?,
			 cron = ?,
			 next_run_at = ?`,
			instanceId,
			data.databaseId,
			data.profileName,
			data.trigger,
			data.cron,
			data.nextRunAt ?? null,
			data.databaseId,
			data.profileName,
			data.trigger,
			data.cron,
			data.nextRunAt ?? null
		);
	},

	// ========== Media Management ==========

	getMediaManagementSync(instanceId: number): MediaManagementSyncData {
		const row = db.queryFirst<MediaManagementRow>(
			'SELECT * FROM arr_sync_media_management WHERE instance_id = ?',
			instanceId
		);

		return {
			namingDatabaseId: row?.naming_database_id ?? null,
			namingConfigName: row?.naming_config_name ?? null,
			qualityDefinitionsDatabaseId: row?.quality_definitions_database_id ?? null,
			qualityDefinitionsConfigName: row?.quality_definitions_config_name ?? null,
			mediaSettingsDatabaseId: row?.media_settings_database_id ?? null,
			mediaSettingsConfigName: row?.media_settings_config_name ?? null,
			trigger: (row?.trigger as SyncTrigger) ?? 'manual',
			cron: row?.cron ?? null
		};
	},

	saveMediaManagementSync(instanceId: number, data: MediaManagementSyncData): void {
		db.execute(
			`INSERT INTO arr_sync_media_management
			 (instance_id, naming_database_id, naming_config_name, quality_definitions_database_id, quality_definitions_config_name, media_settings_database_id, media_settings_config_name, trigger, cron, next_run_at)
			 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
			 ON CONFLICT(instance_id) DO UPDATE SET
			 naming_database_id = ?,
			 naming_config_name = ?,
			 quality_definitions_database_id = ?,
			 quality_definitions_config_name = ?,
			 media_settings_database_id = ?,
			 media_settings_config_name = ?,
			 trigger = ?,
			 cron = ?,
			 next_run_at = ?`,
			instanceId,
			data.namingDatabaseId,
			data.namingConfigName,
			data.qualityDefinitionsDatabaseId,
			data.qualityDefinitionsConfigName,
			data.mediaSettingsDatabaseId,
			data.mediaSettingsConfigName,
			data.trigger,
			data.cron,
			data.nextRunAt ?? null,
			data.namingDatabaseId,
			data.namingConfigName,
			data.qualityDefinitionsDatabaseId,
			data.qualityDefinitionsConfigName,
			data.mediaSettingsDatabaseId,
			data.mediaSettingsConfigName,
			data.trigger,
			data.cron,
			data.nextRunAt ?? null
		);
	},

	// ========== Full Sync Data ==========

	getFullSyncData(instanceId: number) {
		return {
			qualityProfiles: this.getQualityProfilesSync(instanceId),
			delayProfiles: this.getDelayProfilesSync(instanceId),
			mediaManagement: this.getMediaManagementSync(instanceId)
		};
	},

	// ========== Cleanup ==========

	/**
	 * Remove orphaned profile references when a profile is deleted
	 */
	removeQualityProfileReference(profileName: string): number {
		return db.execute('DELETE FROM arr_sync_quality_profiles WHERE profile_name = ?', profileName);
	},

	updateQualityProfileName(oldName: string, newName: string): number {
		return db.execute(
			'UPDATE arr_sync_quality_profiles SET profile_name = ? WHERE profile_name = ?',
			newName,
			oldName
		);
	},

	removeDelayProfileReference(profileName: string): number {
		return db.execute(
			'UPDATE arr_sync_delay_profiles_config SET database_id = NULL, profile_name = NULL WHERE profile_name = ?',
			profileName
		);
	},

	updateDelayProfileName(oldName: string, newName: string): number {
		return db.execute(
			'UPDATE arr_sync_delay_profiles_config SET profile_name = ? WHERE profile_name = ?',
			newName,
			oldName
		);
	},

	/**
	 * Update config name references when a media management config is renamed
	 */
	updateNamingConfigName(oldName: string, newName: string): number {
		return db.execute(
			'UPDATE arr_sync_media_management SET naming_config_name = ? WHERE naming_config_name = ?',
			newName,
			oldName
		);
	},

	updateQualityDefinitionsConfigName(oldName: string, newName: string): number {
		return db.execute(
			'UPDATE arr_sync_media_management SET quality_definitions_config_name = ? WHERE quality_definitions_config_name = ?',
			newName,
			oldName
		);
	},

	updateMediaSettingsConfigName(oldName: string, newName: string): number {
		return db.execute(
			'UPDATE arr_sync_media_management SET media_settings_config_name = ? WHERE media_settings_config_name = ?',
			newName,
			oldName
		);
	},

	/**
	 * Remove all references to a database (when database is deleted)
	 */
	removeDatabaseReferences(databaseId: number): void {
		db.execute('DELETE FROM arr_sync_quality_profiles WHERE database_id = ?', databaseId);
		db.execute(
			'UPDATE arr_sync_delay_profiles_config SET database_id = NULL, profile_name = NULL WHERE database_id = ?',
			databaseId
		);
		db.execute(
			'UPDATE arr_sync_media_management SET naming_database_id = NULL, naming_config_name = NULL WHERE naming_database_id = ?',
			databaseId
		);
		db.execute(
			'UPDATE arr_sync_media_management SET quality_definitions_database_id = NULL, quality_definitions_config_name = NULL WHERE quality_definitions_database_id = ?',
			databaseId
		);
		db.execute(
			'UPDATE arr_sync_media_management SET media_settings_database_id = NULL, media_settings_config_name = NULL WHERE media_settings_database_id = ?',
			databaseId
		);
	},

	// ========== Should Sync Flags ==========

	/**
	 * Set should_sync flag for quality profiles
	 */
	setQualityProfilesShouldSync(instanceId: number, shouldSync: boolean): void {
		db.execute(
			'UPDATE arr_sync_quality_profiles_config SET should_sync = ? WHERE instance_id = ?',
			shouldSync ? 1 : 0,
			instanceId
		);
	},

	/**
	 * Set should_sync flag for delay profiles
	 */
	setDelayProfilesShouldSync(instanceId: number, shouldSync: boolean): void {
		db.execute(
			'UPDATE arr_sync_delay_profiles_config SET should_sync = ? WHERE instance_id = ?',
			shouldSync ? 1 : 0,
			instanceId
		);
	},

	/**
	 * Set should_sync flag for media management
	 */
	setMediaManagementShouldSync(instanceId: number, shouldSync: boolean): void {
		db.execute(
			'UPDATE arr_sync_media_management SET should_sync = ? WHERE instance_id = ?',
			shouldSync ? 1 : 0,
			instanceId
		);
	},

	/**
	 * Mark all configs with a specific trigger as should_sync
	 * Used when events occur (pull, change)
	 * Also sets sync_status to 'pending' for the new status-based flow
	 */
	markForSync(trigger: 'on_pull'): void {
		db.execute(
			`UPDATE arr_sync_quality_profiles_config SET should_sync = 1, sync_status = 'pending' WHERE trigger = ?`,
			trigger
		);
		db.execute(
			`UPDATE arr_sync_delay_profiles_config SET should_sync = 1, sync_status = 'pending' WHERE trigger = ?`,
			trigger
		);
		db.execute(
			`UPDATE arr_sync_media_management SET should_sync = 1, sync_status = 'pending' WHERE trigger = ?`,
			trigger
		);
	},

	/**
	 * Get all configs that need syncing (should_sync = true)
	 */
	getPendingSyncs(): {
		qualityProfiles: number[];
		delayProfiles: number[];
		mediaManagement: number[];
	} {
		const qp = db.query<{ instance_id: number }>(
			'SELECT instance_id FROM arr_sync_quality_profiles_config WHERE should_sync = 1'
		);
		const dp = db.query<{ instance_id: number }>(
			'SELECT instance_id FROM arr_sync_delay_profiles_config WHERE should_sync = 1'
		);
		const mm = db.query<{ instance_id: number }>(
			'SELECT instance_id FROM arr_sync_media_management WHERE should_sync = 1'
		);

		return {
			qualityProfiles: qp.map((r) => r.instance_id),
			delayProfiles: dp.map((r) => r.instance_id),
			mediaManagement: mm.map((r) => r.instance_id)
		};
	},

	/**
	 * Get all scheduled configs that haven't been marked for sync yet
	 */
	getScheduledConfigs(): {
		qualityProfiles: { instanceId: number; cron: string | null; nextRunAt: string | null }[];
		delayProfiles: { instanceId: number; cron: string | null; nextRunAt: string | null }[];
		mediaManagement: { instanceId: number; cron: string | null; nextRunAt: string | null }[];
	} {
		const qp = db.query<{ instance_id: number; cron: string | null; next_run_at: string | null }>(
			"SELECT instance_id, cron, next_run_at FROM arr_sync_quality_profiles_config WHERE trigger = 'schedule' AND should_sync = 0"
		);
		const dp = db.query<{ instance_id: number; cron: string | null; next_run_at: string | null }>(
			"SELECT instance_id, cron, next_run_at FROM arr_sync_delay_profiles_config WHERE trigger = 'schedule' AND should_sync = 0"
		);
		const mm = db.query<{ instance_id: number; cron: string | null; next_run_at: string | null }>(
			"SELECT instance_id, cron, next_run_at FROM arr_sync_media_management WHERE trigger = 'schedule' AND should_sync = 0"
		);

		return {
			qualityProfiles: qp.map((r) => ({
				instanceId: r.instance_id,
				cron: r.cron,
				nextRunAt: r.next_run_at
			})),
			delayProfiles: dp.map((r) => ({
				instanceId: r.instance_id,
				cron: r.cron,
				nextRunAt: r.next_run_at
			})),
			mediaManagement: mm.map((r) => ({
				instanceId: r.instance_id,
				cron: r.cron,
				nextRunAt: r.next_run_at
			}))
		};
	},

	/**
	 * Update next_run_at for a quality profiles config
	 */
	setQualityProfilesNextRunAt(instanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE arr_sync_quality_profiles_config SET next_run_at = ? WHERE instance_id = ?',
			nextRunAt,
			instanceId
		);
	},

	/**
	 * Update next_run_at for a delay profiles config
	 */
	setDelayProfilesNextRunAt(instanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE arr_sync_delay_profiles_config SET next_run_at = ? WHERE instance_id = ?',
			nextRunAt,
			instanceId
		);
	},

	/**
	 * Update next_run_at for a media management config
	 */
	setMediaManagementNextRunAt(instanceId: number, nextRunAt: string | null): void {
		db.execute(
			'UPDATE arr_sync_media_management SET next_run_at = ? WHERE instance_id = ?',
			nextRunAt,
			instanceId
		);
	},

	// ========== Sync Status Methods (Migration 034) ==========

	/**
	 * Atomically claim a sync for processing
	 * Returns true if claim succeeded (status was 'pending' and is now 'in_progress')
	 */
	claimQualityProfilesSync(instanceId: number): boolean {
		const result = db.execute(
			"UPDATE arr_sync_quality_profiles_config SET sync_status = 'in_progress' WHERE instance_id = ? AND sync_status = 'pending'",
			instanceId
		);
		return result > 0;
	},

	claimDelayProfilesSync(instanceId: number): boolean {
		const result = db.execute(
			"UPDATE arr_sync_delay_profiles_config SET sync_status = 'in_progress' WHERE instance_id = ? AND sync_status = 'pending'",
			instanceId
		);
		return result > 0;
	},

	claimMediaManagementSync(instanceId: number): boolean {
		const result = db.execute(
			"UPDATE arr_sync_media_management SET sync_status = 'in_progress' WHERE instance_id = ? AND sync_status = 'pending'",
			instanceId
		);
		return result > 0;
	},

	/**
	 * Mark sync as completed successfully
	 */
	completeQualityProfilesSync(instanceId: number): void {
		db.execute(
			"UPDATE arr_sync_quality_profiles_config SET sync_status = 'idle', should_sync = 0, last_error = NULL, last_synced_at = ? WHERE instance_id = ?",
			new Date().toISOString(),
			instanceId
		);
	},

	completeDelayProfilesSync(instanceId: number): void {
		db.execute(
			"UPDATE arr_sync_delay_profiles_config SET sync_status = 'idle', should_sync = 0, last_error = NULL, last_synced_at = ? WHERE instance_id = ?",
			new Date().toISOString(),
			instanceId
		);
	},

	completeMediaManagementSync(instanceId: number): void {
		db.execute(
			"UPDATE arr_sync_media_management SET sync_status = 'idle', should_sync = 0, last_error = NULL, last_synced_at = ? WHERE instance_id = ?",
			new Date().toISOString(),
			instanceId
		);
	},

	/**
	 * Mark sync as failed
	 */
	failQualityProfilesSync(instanceId: number, error: string): void {
		db.execute(
			"UPDATE arr_sync_quality_profiles_config SET sync_status = 'failed', should_sync = 0, last_error = ? WHERE instance_id = ?",
			error,
			instanceId
		);
	},

	failDelayProfilesSync(instanceId: number, error: string): void {
		db.execute(
			"UPDATE arr_sync_delay_profiles_config SET sync_status = 'failed', should_sync = 0, last_error = ? WHERE instance_id = ?",
			error,
			instanceId
		);
	},

	failMediaManagementSync(instanceId: number, error: string): void {
		db.execute(
			"UPDATE arr_sync_media_management SET sync_status = 'failed', should_sync = 0, last_error = ? WHERE instance_id = ?",
			error,
			instanceId
		);
	},

	/**
	 * Set sync status to pending (used by markForSync and triggers)
	 */
	setQualityProfilesStatusPending(instanceId: number): void {
		db.execute(
			"UPDATE arr_sync_quality_profiles_config SET sync_status = 'pending', should_sync = 1 WHERE instance_id = ?",
			instanceId
		);
	},

	setDelayProfilesStatusPending(instanceId: number): void {
		db.execute(
			"UPDATE arr_sync_delay_profiles_config SET sync_status = 'pending', should_sync = 1 WHERE instance_id = ?",
			instanceId
		);
	},

	setMediaManagementStatusPending(instanceId: number): void {
		db.execute(
			"UPDATE arr_sync_media_management SET sync_status = 'pending', should_sync = 1 WHERE instance_id = ?",
			instanceId
		);
	},

	/**
	 * Get pending syncs by status (uses new sync_status column)
	 */
	getPendingSyncsByStatus(): {
		qualityProfiles: number[];
		delayProfiles: number[];
		mediaManagement: number[];
	} {
		const qp = db.query<{ instance_id: number }>(
			"SELECT instance_id FROM arr_sync_quality_profiles_config WHERE sync_status = 'pending'"
		);
		const dp = db.query<{ instance_id: number }>(
			"SELECT instance_id FROM arr_sync_delay_profiles_config WHERE sync_status = 'pending'"
		);
		const mm = db.query<{ instance_id: number }>(
			"SELECT instance_id FROM arr_sync_media_management WHERE sync_status = 'pending'"
		);

		return {
			qualityProfiles: qp.map((r) => r.instance_id),
			delayProfiles: dp.map((r) => r.instance_id),
			mediaManagement: mm.map((r) => r.instance_id)
		};
	},

	/**
	 * Reset any pending/in_progress syncs back to idle on startup.
	 * If the server restarted, the jobs that were supposed to process
	 * these are gone — neither state is valid anymore.
	 */
	recoverInterruptedSyncs(): number {
		let count = 0;
		count += db.execute(
			"UPDATE arr_sync_quality_profiles_config SET sync_status = 'idle' WHERE sync_status IN ('pending', 'in_progress')"
		);
		count += db.execute(
			"UPDATE arr_sync_delay_profiles_config SET sync_status = 'idle' WHERE sync_status IN ('pending', 'in_progress')"
		);
		count += db.execute(
			"UPDATE arr_sync_media_management SET sync_status = 'idle' WHERE sync_status IN ('pending', 'in_progress')"
		);
		return count;
	},

	/**
	 * Check if any sync configs have a scheduled (cron) trigger
	 * Used to determine if any arr.sync scheduled jobs should be enabled
	 */
	hasAnyScheduledConfigs(): boolean {
		const result = db.queryFirst<{ count: number }>(`
			SELECT COUNT(*) as count FROM (
				SELECT 1 FROM arr_sync_quality_profiles_config WHERE trigger = 'schedule'
				UNION ALL
				SELECT 1 FROM arr_sync_delay_profiles_config WHERE trigger = 'schedule'
				UNION ALL
				SELECT 1 FROM arr_sync_media_management WHERE trigger = 'schedule'
			)
		`);
		return (result?.count ?? 0) > 0;
	},

	getSyncConfigStatus(instanceId: number): {
		qualityProfiles: SyncConfigStatus;
		delayProfiles: SyncConfigStatus;
		mediaManagement: SyncConfigStatus;
	} {
		const qp = db.queryFirst<ConfigStatusRow>(
			'SELECT trigger, cron, next_run_at, sync_status FROM arr_sync_quality_profiles_config WHERE instance_id = ?',
			instanceId
		);
		const dp = db.queryFirst<ConfigStatusRow>(
			'SELECT trigger, cron, next_run_at, sync_status FROM arr_sync_delay_profiles_config WHERE instance_id = ?',
			instanceId
		);
		const mm = db.queryFirst<ConfigStatusRow>(
			'SELECT trigger, cron, next_run_at, sync_status FROM arr_sync_media_management WHERE instance_id = ?',
			instanceId
		);

		return {
			qualityProfiles: {
				trigger: (qp?.trigger as SyncTrigger) ?? 'manual',
				cron: qp?.cron ?? null,
				nextRunAt: qp?.next_run_at ?? null,
				syncStatus: qp?.sync_status ?? 'idle'
			},
			delayProfiles: {
				trigger: (dp?.trigger as SyncTrigger) ?? 'manual',
				cron: dp?.cron ?? null,
				nextRunAt: dp?.next_run_at ?? null,
				syncStatus: dp?.sync_status ?? 'idle'
			},
			mediaManagement: {
				trigger: (mm?.trigger as SyncTrigger) ?? 'manual',
				cron: mm?.cron ?? null,
				nextRunAt: mm?.next_run_at ?? null,
				syncStatus: mm?.sync_status ?? 'idle'
			}
		};
	},

	getNextScheduledRunAt(instanceId: number): string | null {
		const rows = db.query<{ next_run_at: string | null }>(
			`SELECT next_run_at FROM arr_sync_quality_profiles_config WHERE instance_id = ? AND trigger = 'schedule'
			 UNION ALL
			 SELECT next_run_at FROM arr_sync_delay_profiles_config WHERE instance_id = ? AND trigger = 'schedule'
			 UNION ALL
			 SELECT next_run_at FROM arr_sync_media_management WHERE instance_id = ? AND trigger = 'schedule'`,
			instanceId,
			instanceId,
			instanceId
		);

		const candidates = rows
			.map((row) => row.next_run_at)
			.filter((value): value is string => !!value);

		if (candidates.length === 0) return null;

		return candidates.reduce((earliest, current) =>
			new Date(current) < new Date(earliest) ? current : earliest
		);
	},

	/**
	 * Record that an entity sync completed for a section (updates timestamp only)
	 */
	touchSectionLastSynced(
		instanceId: number,
		section: 'qualityProfiles' | 'delayProfiles' | 'mediaManagement'
	): void {
		const table = {
			qualityProfiles: 'arr_sync_quality_profiles_config',
			delayProfiles: 'arr_sync_delay_profiles_config',
			mediaManagement: 'arr_sync_media_management'
		}[section];

		// nosemgrep: profilarr.sql.template-literal-interpolation — table name from hardcoded lookup
		db.execute(
			`UPDATE ${table} SET last_synced_at = ? WHERE instance_id = ?`,
			new Date().toISOString(),
			instanceId
		);
	},

	/**
	 * Get sync status and timing for a specific section of an instance
	 */
	getSectionSyncStatus(
		instanceId: number,
		section: 'qualityProfiles' | 'delayProfiles' | 'mediaManagement'
	): { sync_status: string; last_synced_at: string | null } | undefined {
		const table = {
			qualityProfiles: 'arr_sync_quality_profiles_config',
			delayProfiles: 'arr_sync_delay_profiles_config',
			mediaManagement: 'arr_sync_media_management'
		}[section];

		return db.queryFirst<{ sync_status: string; last_synced_at: string | null }>(
			`SELECT sync_status, last_synced_at FROM ${table} WHERE instance_id = ?`,
			instanceId
		);
	},

	/**
	 * Get arr instances that sync a specific quality profile from a specific database
	 */
	getInstancesForQualityProfile(
		databaseId: number,
		profileName: string
	): {
		instance_id: number;
		instance_name: string;
		sync_status: string;
		last_synced_at: string | null;
	}[] {
		return db.query<{
			instance_id: number;
			instance_name: string;
			sync_status: string;
			last_synced_at: string | null;
		}>(
			`SELECT DISTINCT
				ai.id AS instance_id,
				ai.name AS instance_name,
				qpc.sync_status,
				qpc.last_synced_at
			FROM arr_sync_quality_profiles aqp
			JOIN arr_instances ai ON ai.id = aqp.instance_id
			JOIN arr_sync_quality_profiles_config qpc ON qpc.instance_id = aqp.instance_id
			WHERE aqp.database_id = ? AND aqp.profile_name = ? AND ai.enabled = 1`,
			databaseId,
			profileName
		);
	},

	getInstancesForNaming(
		databaseId: number,
		configName: string
	): {
		instance_id: number;
		instance_name: string;
		sync_status: string;
		last_synced_at: string | null;
	}[] {
		return db.query<{
			instance_id: number;
			instance_name: string;
			sync_status: string;
			last_synced_at: string | null;
		}>(
			`SELECT DISTINCT
				ai.id AS instance_id,
				ai.name AS instance_name,
				mm.sync_status,
				mm.last_synced_at
			FROM arr_sync_media_management mm
			JOIN arr_instances ai ON ai.id = mm.instance_id
			WHERE mm.naming_database_id = ? AND mm.naming_config_name = ? AND ai.enabled = 1`,
			databaseId,
			configName
		);
	},

	getInstancesForDelayProfile(
		databaseId: number,
		profileName: string
	): {
		instance_id: number;
		instance_name: string;
		sync_status: string;
		last_synced_at: string | null;
	}[] {
		return db.query<{
			instance_id: number;
			instance_name: string;
			sync_status: string;
			last_synced_at: string | null;
		}>(
			`SELECT DISTINCT
				ai.id AS instance_id,
				ai.name AS instance_name,
				dpc.sync_status,
				dpc.last_synced_at
			FROM arr_sync_delay_profiles_config dpc
			JOIN arr_instances ai ON ai.id = dpc.instance_id
			WHERE dpc.database_id = ? AND dpc.profile_name = ? AND ai.enabled = 1`,
			databaseId,
			profileName
		);
	},

	getInstancesForMediaSettings(
		databaseId: number,
		configName: string
	): {
		instance_id: number;
		instance_name: string;
		sync_status: string;
		last_synced_at: string | null;
	}[] {
		return db.query<{
			instance_id: number;
			instance_name: string;
			sync_status: string;
			last_synced_at: string | null;
		}>(
			`SELECT DISTINCT
				ai.id AS instance_id,
				ai.name AS instance_name,
				mm.sync_status,
				mm.last_synced_at
			FROM arr_sync_media_management mm
			JOIN arr_instances ai ON ai.id = mm.instance_id
			WHERE mm.media_settings_database_id = ? AND mm.media_settings_config_name = ? AND ai.enabled = 1`,
			databaseId,
			configName
		);
	},

	getInstancesForQualityDefinitions(
		databaseId: number,
		configName: string
	): {
		instance_id: number;
		instance_name: string;
		sync_status: string;
		last_synced_at: string | null;
	}[] {
		return db.query<{
			instance_id: number;
			instance_name: string;
			sync_status: string;
			last_synced_at: string | null;
		}>(
			`SELECT DISTINCT
				ai.id AS instance_id,
				ai.name AS instance_name,
				mm.sync_status,
				mm.last_synced_at
			FROM arr_sync_media_management mm
			JOIN arr_instances ai ON ai.id = mm.instance_id
			WHERE mm.quality_definitions_database_id = ? AND mm.quality_definitions_config_name = ? AND ai.enabled = 1`,
			databaseId,
			configName
		);
	},

	getInstanceIdsForTrigger(trigger: SyncTrigger): number[] {
		const rows = db.query<{ instance_id: number }>(
			`SELECT instance_id FROM arr_sync_quality_profiles_config WHERE trigger = ?
			 UNION
			 SELECT instance_id FROM arr_sync_delay_profiles_config WHERE trigger = ?
			 UNION
			 SELECT instance_id FROM arr_sync_media_management WHERE trigger = ?`,
			trigger,
			trigger,
			trigger
		);

		return rows.map((row) => row.instance_id);
	}
};
