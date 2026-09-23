/**
 * API key generation utility
 * Generates 32 hex character keys (UUID without hyphens, like Sonarr)
 */

/**
 * Generate a new API key
 * Returns 32 lowercase hex characters (122 random bits; a v4 UUID fixes 6 of its 128)
 */
export function generateApiKey(): string {
	return crypto.randomUUID().replace(/-/g, '');
}
