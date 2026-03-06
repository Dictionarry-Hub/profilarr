import { db } from '../db.ts';
import type { AttemptCategory } from '$auth/loginAnalysis.ts';

/**
 * All queries for login_attempts table
 * Tracks failed login attempts for rate limiting
 */
export const loginAttemptsQueries = {
	/**
	 * Record a failed login attempt
	 */
	recordFailure(ip: string, endpoint: string, category: AttemptCategory): void {
		db.execute(
			`INSERT INTO login_attempts (ip, endpoint, category) VALUES (?, ?, ?)`,
			ip,
			endpoint,
			category
		);
	},

	/**
	 * Count recent failures for an IP + endpoint within a time window
	 */
	countRecent(ip: string, endpoint: string, windowMinutes: number): number {
		const result = db.queryFirst<{ count: number }>(
			`SELECT COUNT(*) as count FROM login_attempts
			 WHERE ip = ? AND endpoint = ? AND datetime(failed_at) > datetime('now', ?)`,
			ip,
			endpoint,
			`-${windowMinutes} minutes`
		);
		return result?.count ?? 0;
	},

	/**
	 * Count recent failures for an IP + endpoint filtered by category
	 */
	countRecentByCategory(
		ip: string,
		endpoint: string,
		category: AttemptCategory,
		windowMinutes: number
	): number {
		const result = db.queryFirst<{ count: number }>(
			`SELECT COUNT(*) as count FROM login_attempts
			 WHERE ip = ? AND endpoint = ? AND category = ? AND datetime(failed_at) > datetime('now', ?)`,
			ip,
			endpoint,
			category,
			`-${windowMinutes} minutes`
		);
		return result?.count ?? 0;
	},

	/**
	 * Clear all attempts for an IP (call on successful login)
	 */
	clearForIp(ip: string): number {
		return db.execute(`DELETE FROM login_attempts WHERE ip = ?`, ip);
	},

	/**
	 * Delete old attempts outside the window (cleanup)
	 */
	deleteExpired(windowMinutes: number): number {
		return db.execute(
			`DELETE FROM login_attempts WHERE datetime(failed_at) <= datetime('now', ?)`,
			`-${windowMinutes} minutes`
		);
	}
};
