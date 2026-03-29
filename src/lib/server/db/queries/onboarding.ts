import { db } from '../db.ts';

export const onboardingQueries = {
	getShown(): boolean {
		const result = db.queryFirst<{ onboarding_shown: number }>(
			'SELECT onboarding_shown FROM general_settings WHERE id = 1'
		);
		return result?.onboarding_shown === 1;
	},

	markShown(): void {
		db.execute(
			'UPDATE general_settings SET onboarding_shown = 1, updated_at = CURRENT_TIMESTAMP WHERE id = 1'
		);
	}
};
