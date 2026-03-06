/**
 * Login attempt analysis utilities
 * Helps distinguish between typos and potential attack attempts
 */

// Common usernames attackers try
const COMMON_ATTACK_USERNAMES = [
	'admin',
	'administrator',
	'root',
	'user',
	'test',
	'guest',
	'demo',
	'system',
	'operator',
	'superuser',
	'master',
	'default'
];

/**
 * Check if a username is commonly used in brute force attacks
 */
export function isCommonAttackUsername(username: string): boolean {
	return COMMON_ATTACK_USERNAMES.includes(username.toLowerCase());
}

/**
 * Calculate Levenshtein distance between two strings
 */
function levenshteinDistance(a: string, b: string): number {
	const matrix: number[][] = [];

	for (let i = 0; i <= b.length; i++) {
		matrix[i] = [i];
	}
	for (let j = 0; j <= a.length; j++) {
		matrix[0][j] = j;
	}

	for (let i = 1; i <= b.length; i++) {
		for (let j = 1; j <= a.length; j++) {
			if (b.charAt(i - 1) === a.charAt(j - 1)) {
				matrix[i][j] = matrix[i - 1][j - 1];
			} else {
				matrix[i][j] = Math.min(
					matrix[i - 1][j - 1] + 1, // substitution
					matrix[i][j - 1] + 1, // insertion
					matrix[i - 1][j] + 1 // deletion
				);
			}
		}
	}

	return matrix[b.length][a.length];
}

/**
 * Find a similar username from the list of existing usernames
 * Returns the similar username if found (within 2 edits), null otherwise
 */
export function findSimilarUsername(attempted: string, existingUsernames: string[]): string | null {
	const attemptedLower = attempted.toLowerCase();

	for (const existing of existingUsernames) {
		const distance = levenshteinDistance(attemptedLower, existing.toLowerCase());
		// Allow up to 2 character differences for typo detection
		if (distance > 0 && distance <= 2) {
			return existing;
		}
	}

	return null;
}

export type AttemptCategory = 'typo' | 'suspicious' | 'unknown';

export interface LoginFailureAnalysis {
	reason: 'user_not_found' | 'invalid_password';
	similarUser: string | null;
	isCommonAttack: boolean;
}

/**
 * Derive a rate-limit category from a login failure analysis
 */
export function getAttemptCategory(analysis: LoginFailureAnalysis): AttemptCategory {
	if (analysis.reason === 'invalid_password' || analysis.similarUser) {
		return 'typo';
	}
	if (analysis.isCommonAttack) {
		return 'suspicious';
	}
	return 'unknown';
}

/**
 * Analyze a failed login attempt for logging purposes
 */
export function analyzeLoginFailure(
	username: string,
	existingUsernames: string[],
	userExists: boolean
): LoginFailureAnalysis {
	if (userExists) {
		return {
			reason: 'invalid_password',
			similarUser: null,
			isCommonAttack: false
		};
	}

	return {
		reason: 'user_not_found',
		similarUser: findSimilarUsername(username, existingUsernames),
		isCommonAttack: isCommonAttackUsername(username)
	};
}

/**
 * Format a login failure for logging
 */
export function formatLoginFailure(analysis: LoginFailureAnalysis): string {
	if (analysis.reason === 'invalid_password') {
		return 'invalid password';
	}

	if (analysis.similarUser) {
		return `unknown user (similar to '${analysis.similarUser}')`;
	}

	if (analysis.isCommonAttack) {
		return 'unknown user (common attack username)';
	}

	return 'unknown user';
}
