/**
 * API key permission types and helpers shared by the server and the UI.
 *
 * Areas are the tags in the v1 OpenAPI spec, stored by id (e.g. `databases`).
 * Each operation's `x-permission` says whether it needs `read` or `write`
 * access to its area. Write access includes read.
 */

export type ApiKeyAccess = 'read' | 'write';

/** Area id -> access level. An area missing from the map has no access. */
export type ApiKeyAreaPermissions = Record<string, ApiKeyAccess>;

/** `'all'` grants every area, including areas added after the key was created. */
export type ApiKeyPermissions = 'all' | ApiKeyAreaPermissions;

export interface ApiArea {
	id: string;
	name: string;
	/** Whether any operation in this area needs write access */
	writable: boolean;
}

/** Area id for an OpenAPI tag name */
export function apiAreaId(tag: string): string {
	return tag.trim().toLowerCase().replace(/\s+/g, '-');
}

export function hasApiAccess(
	permissions: ApiKeyPermissions,
	area: string,
	access: ApiKeyAccess
): boolean {
	if (permissions === 'all') return true;
	const granted = permissions[area];
	if (granted === 'write') return true;
	return granted === 'read' && access === 'read';
}

/**
 * Parse stored permissions JSON. Entries with values other than `read` or
 * `write` are ignored, so a key never breaks on data it doesn't understand.
 * Anything unreadable becomes no access.
 */
export function parseApiKeyPermissions(json: string): ApiKeyPermissions {
	let value: unknown;
	try {
		value = JSON.parse(json);
	} catch {
		return {};
	}

	if (value === 'all') return 'all';
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};

	const permissions: ApiKeyAreaPermissions = {};
	for (const [area, access] of Object.entries(value)) {
		if (access === 'read' || access === 'write') {
			permissions[area] = access;
		}
	}
	return permissions;
}

export const API_KEY_EXPIRY_OPTIONS = [
	{ value: '30d', label: '30 days', days: 30 },
	{ value: '90d', label: '90 days', days: 90 },
	{ value: '1y', label: '1 year', days: 365 },
	{ value: 'never', label: 'Never', days: null }
] as const;

export type ApiKeyExpiry = (typeof API_KEY_EXPIRY_OPTIONS)[number]['value'];

export const DEFAULT_API_KEY_EXPIRY: ApiKeyExpiry = '90d';

export function isApiKeyExpiry(value: unknown): value is ApiKeyExpiry {
	return API_KEY_EXPIRY_OPTIONS.some((o) => o.value === value);
}

/** Expiry timestamp (UTC ISO) for an expiry option, or null for never */
export function apiKeyExpiresAt(expiry: ApiKeyExpiry, from: Date = new Date()): string | null {
	const option = API_KEY_EXPIRY_OPTIONS.find((o) => o.value === expiry);
	if (!option) throw new Error(`Unknown API key expiry: ${expiry}`);
	if (option.days === null) return null;
	return new Date(from.getTime() + option.days * 24 * 60 * 60 * 1000).toISOString();
}

export function isApiKeyExpired(expiresAt: string | null, now: Date = new Date()): boolean {
	return expiresAt !== null && new Date(expiresAt).getTime() <= now.getTime();
}
