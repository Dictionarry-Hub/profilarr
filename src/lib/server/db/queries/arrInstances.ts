import { db } from '../db.ts';
import { normalizeArrInstanceUrl } from '$arr/url.ts';
import { arrSyncQueries } from './arrSync.ts';

/**
 * Types for arr_instances table
 */
export interface ArrInstance {
	id: number;
	name: string;
	type: string;
	url: string;
	external_url: string | null;
	api_key: string;
	tags: string | null;
	enabled: number;
	library_refresh_interval: number;
	library_last_refreshed_at: string | null;
	created_at: string;
	updated_at: string;
}

export type ArrInstancePublic = Omit<ArrInstance, 'api_key'>;

export interface CreateArrInstanceInput {
	name: string;
	type: string;
	url: string;
	externalUrl?: string | null;
	apiKey: string;
	tags?: string[];
}

export interface UpdateArrInstanceInput {
	name?: string;
	type?: string;
	url?: string;
	externalUrl?: string | null;
	apiKey?: string;
	tags?: string[];
	libraryRefreshInterval?: number;
}

/**
 * All queries for arr_instances table
 */
export const arrInstancesQueries = {
	/**
	 * Create a new arr instance
	 */
	create(input: CreateArrInstanceInput): number {
		const tagsJson = input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null;

		db.execute(
			`INSERT INTO arr_instances (name, type, url, external_url, api_key, tags, enabled)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			input.name,
			input.type,
			input.url,
			input.externalUrl ?? null,
			input.apiKey,
			tagsJson,
			1
		);

		// Get the last inserted ID
		const result = db.queryFirst<{ id: number }>('SELECT last_insert_rowid() as id');
		const id = result?.id ?? 0;

		if (id > 0) {
			arrSyncQueries.ensureAllInstancePriorities(id);
		}

		return id;
	},

	/**
	 * Get an arr instance by ID
	 */
	getById(id: number): ArrInstance | undefined {
		return db.queryFirst<ArrInstance>('SELECT * FROM arr_instances WHERE id = ?', id);
	},

	/**
	 * Get all arr instances
	 */
	getAll(): ArrInstance[] {
		return db.query<ArrInstance>('SELECT * FROM arr_instances ORDER BY type, name');
	},

	/**
	 * Get arr instances by type
	 */
	getByType(type: string): ArrInstance[] {
		return db.query<ArrInstance>('SELECT * FROM arr_instances WHERE type = ? ORDER BY name', type);
	},

	/**
	 * Get enabled arr instances
	 */
	getEnabled(): ArrInstance[] {
		return db.query<ArrInstance>(
			'SELECT * FROM arr_instances WHERE enabled = 1 ORDER BY type, name'
		);
	},

	/**
	 * Update an arr instance
	 */
	update(id: number, input: UpdateArrInstanceInput): boolean {
		const updates: string[] = [];
		const params: (string | number | null)[] = [];

		if (input.name !== undefined) {
			updates.push('name = ?');
			params.push(input.name);
		}
		if (input.type !== undefined) {
			updates.push('type = ?');
			params.push(input.type);
		}
		if (input.url !== undefined) {
			updates.push('url = ?');
			params.push(input.url);
		}
		if (input.externalUrl !== undefined) {
			updates.push('external_url = ?');
			params.push(input.externalUrl);
		}
		if (input.apiKey !== undefined) {
			updates.push('api_key = ?');
			params.push(input.apiKey);
		}
		if (input.tags !== undefined) {
			updates.push('tags = ?');
			params.push(input.tags.length > 0 ? JSON.stringify(input.tags) : null);
		}
		if (input.libraryRefreshInterval !== undefined) {
			updates.push('library_refresh_interval = ?');
			params.push(input.libraryRefreshInterval);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(id);

		const affected = db.execute(
			`UPDATE arr_instances SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	},

	/**
	 * Delete an arr instance
	 */
	delete(id: number): boolean {
		const affected = db.execute('DELETE FROM arr_instances WHERE id = ?', id);
		return affected > 0;
	},

	/**
	 * Check if an instance name already exists
	 */
	nameExists(name: string, excludeId?: number): boolean {
		if (excludeId !== undefined) {
			const result = db.queryFirst<{ count: number }>(
				'SELECT COUNT(*) as count FROM arr_instances WHERE name = ? AND id != ?',
				name,
				excludeId
			);
			return (result?.count ?? 0) > 0;
		}

		const result = db.queryFirst<{ count: number }>(
			'SELECT COUNT(*) as count FROM arr_instances WHERE name = ?',
			name
		);
		return (result?.count ?? 0) > 0;
	},

	/**
	 * Update library_last_refreshed_at timestamp
	 */
	updateLibraryRefreshedAt(id: number): void {
		db.execute(
			'UPDATE arr_instances SET library_last_refreshed_at = ? WHERE id = ?',
			new Date().toISOString(),
			id
		);
	},

	/**
	 * Check if an instance with the same type and normalized URL already exists
	 */
	targetExists(type: string, url: string, excludeId?: number): boolean {
		const normalizedUrl = normalizeArrInstanceUrl(url);
		const instances = db.query<Pick<ArrInstance, 'id' | 'url'>>(
			'SELECT id, url FROM arr_instances WHERE type = ?',
			type
		);

		return instances.some((instance) => {
			if (excludeId !== undefined && instance.id === excludeId) return false;
			return normalizeArrInstanceUrl(instance.url) === normalizedUrl;
		});
	}
};
