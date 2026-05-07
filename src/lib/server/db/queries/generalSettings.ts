import { db } from '../db.ts';
import type { DateFormat } from '$shared/utils/dates.ts';

export type { DateFormat } from '$shared/utils/dates.ts';

/**
 * Types for general_settings table
 */
export interface GeneralSettings {
	id: number;
	date_format: DateFormat;
	apply_default_delay_profiles: number; // 1=true, 0=false
	fail_on_referenced_delete: number; // 1=true, 0=false
	created_at: string;
	updated_at: string;
}

export interface UpdateGeneralSettingsInput {
	dateFormat?: DateFormat;
	applyDefaultDelayProfiles?: boolean;
	failOnReferencedDelete?: boolean;
}

/**
 * All queries for general_settings table
 * Singleton pattern - only one settings record exists
 */
export const generalSettingsQueries = {
	/**
	 * Get the general settings (singleton)
	 */
	get(): GeneralSettings | undefined {
		return db.queryFirst<GeneralSettings>('SELECT * FROM general_settings WHERE id = 1');
	},

	/**
	 * Check if default delay profiles should be applied when adding arr
	 */
	shouldApplyDefaultDelayProfiles(): boolean {
		const settings = this.get();
		return settings?.apply_default_delay_profiles === 1;
	},

	/**
	 * Check if referenced custom format and regex deletes should be blocked
	 */
	shouldFailOnReferencedDelete(): boolean {
		const settings = this.get();
		return settings?.fail_on_referenced_delete === 1;
	},

	/**
	 * Update general settings
	 */
	update(input: UpdateGeneralSettingsInput): boolean {
		const updates: string[] = [];
		const params: (string | number)[] = [];

		if (input.dateFormat !== undefined) {
			updates.push('date_format = ?');
			params.push(input.dateFormat);
		}

		if (input.applyDefaultDelayProfiles !== undefined) {
			updates.push('apply_default_delay_profiles = ?');
			params.push(input.applyDefaultDelayProfiles ? 1 : 0);
		}

		if (input.failOnReferencedDelete !== undefined) {
			updates.push('fail_on_referenced_delete = ?');
			params.push(input.failOnReferencedDelete ? 1 : 0);
		}

		if (updates.length === 0) {
			return false;
		}

		// Add updated_at
		updates.push('updated_at = CURRENT_TIMESTAMP');
		params.push(1); // id is always 1

		const affected = db.execute(
			`UPDATE general_settings SET ${updates.join(', ')} WHERE id = ?`,
			...params
		);

		return affected > 0;
	}
};
