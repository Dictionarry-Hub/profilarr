import { db } from '../db.ts';

export type ConflictStrategy = 'override' | 'align' | 'ask';

/**
 * Types for database_instances table
 */
export interface DatabaseInstance {
	id: number;
	uuid: string;
	name: string;
	repository_url: string;
	local_path: string;
	sync_strategy: number;
	auto_pull: number;
	enabled: number;
	personal_access_token: string | null;
	is_private: number;
	local_ops_enabled: number;
	git_user_name: string | null;
	git_user_email: string | null;
	conflict_strategy: ConflictStrategy;
	last_synced_at: string | null;
	created_at: string;
	updated_at: string;
}

export type DatabaseInstancePublic = Omit<DatabaseInstance, 'personal_access_token'> & {
	hasPat: boolean;
};

export interface CreateDatabaseInstanceInput {
	uuid: string;
	name: string;
	repositoryUrl: string;
	localPath: string;
	syncStrategy?: number;
	autoPull?: boolean;
	enabled?: boolean;
	personalAccessToken?: string;
	gitUserName?: string;
	gitUserEmail?: string;
	isPrivate?: boolean;
	localOpsEnabled?: boolean;
	conflictStrategy?: ConflictStrategy;
}

export interface UpdateDatabaseInstanceInput {
	name?: string;
	repositoryUrl?: string;
	syncStrategy?: number;
	autoPull?: boolean;
	enabled?: boolean;
	personalAccessToken?: string;
	localOpsEnabled?: boolean;
	gitUserName?: string | null;
	gitUserEmail?: string | null;
	conflictStrategy?: ConflictStrategy;
}

/**
 * All queries for database_instances table
 */
export const databaseInstancesQueries = {
	/**
	 * Create a new database instance
	 */
	create(input: CreateDatabaseInstanceInput): number {
		const syncStrategy = input.syncStrategy ?? 0;
		const autoPull = input.autoPull !== false ? 1 : 0;
		const enabled = input.enabled !== false ? 1 : 0;
		const personalAccessToken = input.personalAccessToken || null;
		const isPrivate = input.isPrivate ? 1 : 0;
		const localOpsEnabled = input.localOpsEnabled ? 1 : 0;
		const gitUserName = input.gitUserName || null;
		const gitUserEmail = input.gitUserEmail || null;
		const conflictStrategy = input.conflictStrategy ?? 'override';

		db.execute(
			`INSERT INTO database_instances (
				uuid,
				name,
				repository_url,
				local_path,
				sync_strategy,
				auto_pull,
				enabled,
				personal_access_token,
				is_private,
				local_ops_enabled,
				git_user_name,
				git_user_email,
				conflict_strategy
			) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			input.uuid,
			input.name,
			input.repositoryUrl,
			input.localPath,
			syncStrategy,
			autoPull,
			enabled,
			personalAccessToken,
			isPrivate,
			localOpsEnabled,
			gitUserName,
			gitUserEmail,
			conflictStrategy
		);

		// Get the last inserted ID
		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		return result?.id ?? 0;
	},

	/**
	 * Get a database instance by ID
	 */
	getById(id: number): DatabaseInstance | undefined {
		return db.queryFirst<DatabaseInstance>('SELECT * FROM database_instances WHERE id = ?', id);
	},

	/**
	 * Get a database instance by UUID
	 */
	getByUuid(uuid: string): DatabaseInstance | undefined {
		return db.queryFirst<DatabaseInstance>('SELECT * FROM database_instances WHERE uuid = ?', uuid);
	},

	/**
	 * Get all database instances
	 */
	getAll(): DatabaseInstance[] {
		return db.query<DatabaseInstance>('SELECT * FROM database_instances ORDER BY name');
	},

	/**
	 * Get enabled database instances
	 */
	getEnabled(): DatabaseInstance[] {
		return db.query<DatabaseInstance>(
			'SELECT * FROM database_instances WHERE enabled = 1 ORDER BY name'
		);
	},

	/**
	 * Get databases that need auto-sync check
	 * Note: last_synced_at may be ISO format (with T and Z), normalize for datetime()
	 */
	getDueForSync(): DatabaseInstance[] {
		return db.query<DatabaseInstance>(
			`SELECT * FROM database_instances
       WHERE enabled = 1
       AND sync_strategy > 0
       AND (
         last_synced_at IS NULL
         OR datetime(replace(replace(last_synced_at, 'T', ' '), 'Z', ''), '+' || sync_strategy || ' minutes') <= datetime('now')
       )
       ORDER BY last_synced_at ASC NULLS FIRST`
		);
	},

	/**
	 * Update a database instance
	 */
	update(id: number, input: UpdateDatabaseInstanceInput): boolean {
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

		if (input.name !== undefined) {
			updates.push('name = ?');
			params.push(input.name);
		}
		if (input.repositoryUrl !== undefined) {
			updates.push('repository_url = ?');
			params.push(input.repositoryUrl);
		}
		if (input.syncStrategy !== undefined) {
			updates.push('sync_strategy = ?');
			params.push(input.syncStrategy);
		}
		if (input.autoPull !== undefined) {
			updates.push('auto_pull = ?');
			params.push(input.autoPull ? 1 : 0);
		}
		if (input.enabled !== undefined) {
			updates.push('enabled = ?');
			params.push(input.enabled ? 1 : 0);
		}
		if (input.personalAccessToken !== undefined) {
			updates.push('personal_access_token = ?');
			params.push(input.personalAccessToken || null);
		}
		if (input.localOpsEnabled !== undefined) {
			updates.push('local_ops_enabled = ?');
			params.push(input.localOpsEnabled ? 1 : 0);
		}
		if (input.gitUserName !== undefined) {
			updates.push('git_user_name = ?');
			params.push(input.gitUserName || null);
		}
		if (input.gitUserEmail !== undefined) {
			updates.push('git_user_email = ?');
			params.push(input.gitUserEmail || null);
		}
		if (input.conflictStrategy !== undefined) {
			updates.push('conflict_strategy = ?');
			params.push(input.conflictStrategy);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(id);

		const affected = db.execute(
			`UPDATE database_instances SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Update last_synced_at timestamp
	 */
	updateSyncedAt(id: number): boolean {
		const affected = db.execute(
			'UPDATE database_instances SET last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
			id
		);
		return affected > 0;
	},

	/**
	 * Delete a database instance
	 */
	delete(id: number): boolean {
		const affected = db.execute('DELETE FROM database_instances WHERE id = ?', id);
		return affected > 0;
	},

	/**
	 * Check if a database name already exists
	 */
	nameExists(name: string, excludeId?: number): boolean {
		if (excludeId !== undefined) {
			const result = db.queryFirst<{ count: number }>(
				'SELECT COUNT(*) as count FROM database_instances WHERE name = ? AND id != ?',
				name,
				excludeId
			);
			return (result?.count ?? 0) > 0;
		}

		const result = db.queryFirst<{ count: number }>(
			'SELECT COUNT(*) as count FROM database_instances WHERE name = ?',
			name
		);
		return (result?.count ?? 0) > 0;
	},

	/**
	 * Disable a database instance (set enabled = 0)
	 */
	disable(id: number): boolean {
		const affected = db.execute(
			'UPDATE database_instances SET enabled = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
			id
		);
		return affected > 0;
	}
};

/**
 * Helper function to disable a database instance
 */
export function disableDatabaseInstance(id: number): boolean {
	return databaseInstancesQueries.disable(id);
}
