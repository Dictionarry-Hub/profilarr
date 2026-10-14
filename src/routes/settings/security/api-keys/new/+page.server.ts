import type { Actions, ServerLoad } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { apiKeysQueries } from '$db/queries/apiKeys.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { API_AREAS } from '$auth/apiPermissions.ts';
import {
	isRecentlyConfirmed,
	requiredConfirmation,
	REAUTH_RETURN_PATH
} from '$auth/confirmation.ts';
import { isOidcUsername } from '$auth/loginOptions.ts';
import { verifyPassword } from '$auth/password.ts';
import { getClientIp } from '$auth/network.ts';
import { checkRateLimit, recordFailedAttempt, clearAttempts } from '$auth/rateLimit.ts';
import {
	ENV_API_KEY_NAME,
	apiKeyExpiresAt,
	isApiKeyExpiry,
	type ApiKeyAreaPermissions,
	type ApiKeyPermissions
} from '$shared/apiKeys.ts';
import { logger } from '$logger/logger.ts';

const MAX_NAME_LENGTH = 64;

export const load: ServerLoad = ({ locals }) => ({
	apiAreas: API_AREAS,
	confirmation: requiredConfirmation(locals.session, locals.user)
});

/**
 * Keep only known areas, and only grant write where the area has a write
 * endpoint.
 */
function parseAreaPermissions(raw: string): ApiKeyAreaPermissions | null {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;

	const input = value as Record<string, unknown>;
	const permissions: ApiKeyAreaPermissions = {};
	for (const area of API_AREAS) {
		const access = input[area.id];
		if (access === 'read' || (access === 'write' && area.writable)) {
			permissions[area.id] = access;
		}
	}
	return permissions;
}

export const actions: Actions = {
	/**
	 * Password sessions prove their identity here; SSO sessions use
	 * /auth/oidc/login?reauth=1 instead. Throttled like the login page, since a
	 * script in a hijacked session could otherwise guess at the password.
	 */
	confirm: async (event) => {
		const { request, locals } = event;
		const session = locals.session;
		const user = locals.user;
		if (!session || !user) {
			return fail(400, { confirmError: 'No session to confirm' });
		}
		if (isOidcUsername(user.username)) {
			return fail(403, {
				confirmError: 'Signed in with SSO; confirm through your provider instead'
			});
		}

		const ip = getClientIp(event, false);
		const rateLimit = checkRateLimit(ip, REAUTH_RETURN_PATH);
		if (rateLimit.blocked) {
			await logger.warn('Identity confirmation rate limited', {
				source: 'Auth:RateLimit',
				meta: { ip, retryAfter: rateLimit.retryAfter }
			});
			return fail(429, { confirmError: 'Too many attempts. Please try again later.' });
		}

		const formData = await request.formData();
		const password = String(formData.get('password') ?? '');
		if (!password) {
			return fail(400, { confirmError: 'Enter your password' });
		}

		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			recordFailedAttempt(ip, REAUTH_RETURN_PATH, 'typo');
			await logger.warn(`Identity confirmation failed for '${user.username}'`, {
				source: 'Auth',
				meta: { username: user.username, ip }
			});
			return fail(400, { confirmError: 'Incorrect password' });
		}

		clearAttempts(ip);
		sessionsQueries.markConfirmed(session.id);
		await logger.info(`Identity confirmed for '${user.username}'`, {
			source: 'Auth',
			meta: { username: user.username, ip }
		});
		return { confirmed: true };
	},

	create: async ({ request, locals }) => {
		// A key outlives the session that created it, so the session must have
		// proved its identity recently. No session means AUTH=off.
		if (locals.session && !isRecentlyConfirmed(locals.session.confirmed_at)) {
			return fail(403, { error: 'Confirm it is you before creating a key' });
		}

		const formData = await request.formData();
		const name = String(formData.get('name') ?? '').trim();
		const expiry = formData.get('expiry');
		const fullAccess = formData.get('fullAccess') === 'on';

		if (!name) {
			return fail(400, { error: 'Name is required' });
		}
		if (name.length > MAX_NAME_LENGTH) {
			return fail(400, { error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
		}
		if (name.toLowerCase() === ENV_API_KEY_NAME.toLowerCase()) {
			return fail(400, { error: `"${ENV_API_KEY_NAME}" is reserved for PROFILARR_API_KEY` });
		}
		if (apiKeysQueries.nameExists(name)) {
			return fail(409, { error: `An API key named "${name}" already exists` });
		}
		if (!isApiKeyExpiry(expiry)) {
			return fail(400, { error: 'Invalid expiry' });
		}

		let permissions: ApiKeyPermissions = 'all';
		if (!fullAccess) {
			const areaPermissions = parseAreaPermissions(String(formData.get('permissions') ?? '{}'));
			if (areaPermissions === null) {
				return fail(400, { error: 'Invalid permissions' });
			}
			if (Object.keys(areaPermissions).length === 0) {
				return fail(400, {
					error: 'Grant access to at least one area, or give the key full access'
				});
			}
			permissions = areaPermissions;
		}

		let created;
		try {
			created = await apiKeysQueries.create({
				name,
				permissions,
				expiresAt: apiKeyExpiresAt(expiry)
			});
		} catch (error) {
			// The unique index catches a name taken between the check and the insert
			if (apiKeysQueries.nameExists(name)) {
				return fail(409, { error: `An API key named "${name}" already exists` });
			}
			throw error;
		}

		await logger.info(`API key '${name}' created`, {
			source: 'Auth:APIKey',
			meta: {
				id: created.apiKey.id,
				name,
				permissions,
				expiresAt: created.apiKey.expiresAt
			}
		});

		return { created: { name, key: created.key } };
	}
};
