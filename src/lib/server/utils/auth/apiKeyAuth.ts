/**
 * API key resolution
 *
 * Matches an incoming X-Api-Key against the PROFILARR_API_KEY env key and
 * every stored key. Stored keys are bcrypt-hashed and carry no identifier, so
 * an unknown key is checked against each hash in turn. Keys that have matched
 * before are remembered in memory (by SHA-256 of the key) so repeat requests
 * skip bcrypt. The row is re-read on every hit, so deleted keys stop working
 * immediately and expiry is always current.
 */

import { verify } from '@felix/bcrypt';
import { config } from '$config';
import { apiKeysQueries } from '$db/queries/apiKeys.ts';
import { isApiKeyExpired, type ApiKeyPermissions } from '$shared/apiKeys.ts';
import { logger } from '$logger/logger.ts';

export interface ResolvedApiKey {
	/** null for the env key, which has no row */
	id: number | null;
	name: string;
	permissions: ApiKeyPermissions;
}

export type ApiKeyResolution =
	| { status: 'valid'; key: ResolvedApiKey }
	| { status: 'expired'; key: ResolvedApiKey }
	| { status: 'invalid' };

export const ENV_API_KEY_NAME = 'Environment';

const LAST_USED_THROTTLE_MS = 60 * 1000;

const encoder = new TextEncoder();

/** SHA-256 of a matched key -> api_keys.id */
const matchedKeys = new Map<string, number>();

/** Keys whose stored hash failed to parse, so the warning is logged once */
const reportedBrokenHashes = new Set<number>();

async function sha256Hex(value: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', encoder.encode(value));
	return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

async function timingSafeStringEquals(left: string, right: string): Promise<boolean> {
	const [leftHash, rightHash] = await Promise.all([
		crypto.subtle.digest('SHA-256', encoder.encode(left)),
		crypto.subtle.digest('SHA-256', encoder.encode(right))
	]);

	const leftBytes = new Uint8Array(leftHash);
	const rightBytes = new Uint8Array(rightHash);
	let diff = 0;

	for (let i = 0; i < leftBytes.length; i++) {
		diff |= leftBytes[i] ^ rightBytes[i];
	}

	return diff === 0;
}

function resolveStoredKey(id: number): ApiKeyResolution {
	const apiKey = apiKeysQueries.getById(id);
	if (!apiKey) return { status: 'invalid' };

	const key: ResolvedApiKey = { id: apiKey.id, name: apiKey.name, permissions: apiKey.permissions };
	if (isApiKeyExpired(apiKey.expiresAt)) {
		return { status: 'expired', key };
	}

	const lastUsed = apiKey.lastUsedAt ? new Date(apiKey.lastUsedAt).getTime() : 0;
	if (Date.now() - lastUsed >= LAST_USED_THROTTLE_MS) {
		apiKeysQueries.touchLastUsed(apiKey.id);
	}

	return { status: 'valid', key };
}

/**
 * Resolve an incoming API key to the key it matches.
 */
export async function resolveApiKey(candidate: string): Promise<ApiKeyResolution> {
	if (config.profilarrApiKey !== null) {
		if (await timingSafeStringEquals(candidate, config.profilarrApiKey)) {
			return {
				status: 'valid',
				key: { id: null, name: ENV_API_KEY_NAME, permissions: 'all' }
			};
		}
	}

	const digest = await sha256Hex(candidate);
	const cachedId = matchedKeys.get(digest);
	if (cachedId !== undefined) {
		const resolution = resolveStoredKey(cachedId);
		if (resolution.status === 'invalid') matchedKeys.delete(digest);
		return resolution;
	}

	for (const { id, keyHash } of apiKeysQueries.getHashes()) {
		if (await verifyHash(candidate, id, keyHash)) {
			matchedKeys.set(digest, id);
			return resolveStoredKey(id);
		}
	}

	return { status: 'invalid' };
}

/**
 * A malformed stored hash counts as no match rather than failing every
 * request. It's logged once so the broken key can be found and replaced.
 */
async function verifyHash(candidate: string, id: number, keyHash: string): Promise<boolean> {
	try {
		return await verify(candidate, keyHash);
	} catch (error) {
		if (!reportedBrokenHashes.has(id)) {
			reportedBrokenHashes.add(id);
			void logger.warn('Stored API key hash is invalid; the key cannot be used', {
				source: 'Auth:APIKey',
				meta: { id, error: String(error) }
			});
		}
		return false;
	}
}
