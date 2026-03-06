/**
 * Rate limiting for login endpoints
 *
 * Uses SQLite-backed attempt tracking so counters survive restarts.
 * Category-aware: suspicious attempts (attack usernames) trigger faster
 * than typos (wrong password, similar username).
 */

import { loginAttemptsQueries } from '$db/queries/loginAttempts.ts';
import type { AttemptCategory } from '$auth/loginAnalysis.ts';

const WINDOW_MINUTES = 15;

const THRESHOLDS: Record<string, number> = {
	suspicious: 3,
	typo: 10,
	unknown: 10
};

export interface RateLimitResult {
	blocked: boolean;
	retryAfter?: number;
}

/**
 * Check if an IP is rate limited for an endpoint.
 *
 * Blocked if ANY category exceeds its threshold within the window.
 */
export function checkRateLimit(ip: string, endpoint: string): RateLimitResult {
	for (const [category, threshold] of Object.entries(THRESHOLDS)) {
		const count = loginAttemptsQueries.countRecentByCategory(
			ip,
			endpoint,
			category as AttemptCategory,
			WINDOW_MINUTES
		);
		if (count >= threshold) {
			return {
				blocked: true,
				retryAfter: WINDOW_MINUTES * 60
			};
		}
	}
	return { blocked: false };
}

/**
 * Record a failed login attempt
 */
export function recordFailedAttempt(ip: string, endpoint: string, category: AttemptCategory): void {
	loginAttemptsQueries.recordFailure(ip, endpoint, category);
}

/**
 * Clear attempts for an IP (call on successful login)
 */
export function clearAttempts(ip: string): void {
	loginAttemptsQueries.clearForIp(ip);
}

/**
 * Clean up expired attempts (call on startup / periodically)
 */
export function cleanupExpiredAttempts(): number {
	return loginAttemptsQueries.deleteExpired(WINDOW_MINUTES);
}
