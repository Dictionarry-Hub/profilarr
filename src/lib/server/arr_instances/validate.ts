import { basicAuthPairError } from '#shared/arr/basicAuth.ts';
import type { ArrType } from '#arr/types.ts';

/**
 * Validation of Arr instance input, shared by the web UI form actions and the
 * API. Both build the same raw record (API field names): a key that is absent
 * is kept as it is, `null` or "" clears where clearing is allowed.
 *
 * Pure: `service.ts` owns the database checks (name and target conflicts)
 * and the rules that depend on the stored row (secret follows destination).
 */

export interface ValidatedCreateInstance {
	name: string;
	type: ArrType;
	url: string;
	externalUrl: string | null;
	apiKey: string;
	basicAuthUsername: string | null;
	basicAuthPassword: string | null;
	tags: string[];
}

/** Fields left out are kept. A field sent as `null` is cleared where clearing is allowed. */
export interface ValidatedUpdateInstance {
	name?: string;
	url?: string;
	externalUrl?: string | null;
	apiKey?: string;
	basicAuthUsername?: string | null;
	basicAuthPassword?: string | null;
	tags?: string[];
	libraryRefreshInterval?: number;
}

export type ValidationResult<T> = { ok: true; input: T } | { ok: false; error: string };

const ARR_TYPES: readonly ArrType[] = ['radarr', 'sonarr'];

const UPDATABLE_FIELDS = [
	'name',
	'url',
	'external_url',
	'api_key',
	'basic_auth_username',
	'basic_auth_password',
	'tags',
	'library_refresh_interval'
] as const;

function isArrType(value: unknown): value is ArrType {
	return typeof value === 'string' && (ARR_TYPES as readonly string[]).includes(value);
}

function nonEmptyString(value: unknown): string | null {
	return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function isStringArray(value: unknown): value is string[] {
	return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

/**
 * A nullable optional string: undefined (absent) stays undefined, null and ""
 * clear the field, anything else must be a string. Returns an error message
 * for the wrong type.
 */
function readClearableString(
	body: Record<string, unknown>,
	key: string,
	{ trim }: { trim: boolean }
): { value: string | null | undefined } | { error: string } {
	const raw = body[key];
	if (raw === undefined) return { value: undefined };
	if (raw === null) return { value: null };
	if (typeof raw !== 'string') return { error: `${key} must be a string or null` };

	const value = trim ? raw.trim() : raw;
	return { value: value === '' ? null : value };
}

export function validateCreateInstanceInput(
	body: Record<string, unknown>
): ValidationResult<ValidatedCreateInstance> {
	const name = nonEmptyString(body.name);
	const url = nonEmptyString(body.url);
	const apiKey = nonEmptyString(body.api_key);

	if (!name || !url || !apiKey) {
		return { ok: false, error: 'Name, type, URL, and API key are required' };
	}

	if (!isArrType(body.type)) {
		return { ok: false, error: 'Invalid arr type' };
	}

	const externalUrl = readClearableString(body, 'external_url', { trim: true });
	if ('error' in externalUrl) return { ok: false, error: externalUrl.error };

	const basicAuthUsername = readClearableString(body, 'basic_auth_username', { trim: true });
	if ('error' in basicAuthUsername) return { ok: false, error: basicAuthUsername.error };

	const basicAuthPassword = readClearableString(body, 'basic_auth_password', { trim: false });
	if ('error' in basicAuthPassword) return { ok: false, error: basicAuthPassword.error };

	const pairError = basicAuthPairError(!!basicAuthUsername.value, !!basicAuthPassword.value);
	if (pairError) return { ok: false, error: pairError };

	if (body.tags !== undefined && !isStringArray(body.tags)) {
		return { ok: false, error: 'tags must be an array of strings' };
	}

	return {
		ok: true,
		input: {
			name,
			type: body.type,
			url,
			externalUrl: externalUrl.value ?? null,
			apiKey,
			basicAuthUsername: basicAuthUsername.value ?? null,
			basicAuthPassword: basicAuthPassword.value ?? null,
			tags: body.tags ?? []
		}
	};
}

export function validateUpdateInstanceInput(
	body: Record<string, unknown>
): ValidationResult<ValidatedUpdateInstance> {
	if ('type' in body) {
		return { ok: false, error: 'An instance type cannot be changed' };
	}

	if (!UPDATABLE_FIELDS.some((field) => body[field] !== undefined)) {
		return { ok: false, error: 'No fields to update' };
	}

	const input: ValidatedUpdateInstance = {};

	if (body.name !== undefined) {
		const name = nonEmptyString(body.name);
		if (!name) return { ok: false, error: 'Name is required' };
		input.name = name;
	}

	if (body.url !== undefined) {
		const url = nonEmptyString(body.url);
		if (!url) return { ok: false, error: 'URL is required' };
		input.url = url;
	}

	if (body.api_key !== undefined) {
		const apiKey = nonEmptyString(body.api_key);
		if (!apiKey) return { ok: false, error: 'API key cannot be empty' };
		input.apiKey = apiKey;
	}

	const externalUrl = readClearableString(body, 'external_url', { trim: true });
	if ('error' in externalUrl) return { ok: false, error: externalUrl.error };
	if (externalUrl.value !== undefined) input.externalUrl = externalUrl.value;

	const basicAuthUsername = readClearableString(body, 'basic_auth_username', { trim: true });
	if ('error' in basicAuthUsername) return { ok: false, error: basicAuthUsername.error };
	if (basicAuthUsername.value !== undefined) input.basicAuthUsername = basicAuthUsername.value;

	const basicAuthPassword = readClearableString(body, 'basic_auth_password', { trim: false });
	if ('error' in basicAuthPassword) return { ok: false, error: basicAuthPassword.error };
	if (basicAuthPassword.value !== undefined) input.basicAuthPassword = basicAuthPassword.value;

	if (body.tags !== undefined) {
		if (!isStringArray(body.tags)) return { ok: false, error: 'tags must be an array of strings' };
		input.tags = body.tags;
	}

	if (body.library_refresh_interval !== undefined) {
		const interval = body.library_refresh_interval;
		if (typeof interval !== 'number' || !Number.isInteger(interval) || interval < 0) {
			return { ok: false, error: 'library_refresh_interval must be a non-negative integer' };
		}
		input.libraryRefreshInterval = interval;
	}

	return { ok: true, input };
}
