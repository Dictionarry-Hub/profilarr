import type { Actions, ServerLoad } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { usersQueries } from '$db/queries/users.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { apiKeysQueries } from '$db/queries/apiKeys.ts';
import { hashPassword, verifyPassword } from '$auth/password.ts';
import { API_AREAS } from '$auth/apiPermissions.ts';
import { config } from '$config';
import { isApiKeyExpired } from '$shared/apiKeys.ts';
import { logger } from '$logger/logger.ts';

function loadApiKeys() {
	return {
		apiKeys: apiKeysQueries.list().map((key) => ({
			...key,
			expired: isApiKeyExpired(key.expiresAt)
		})),
		hasEnvApiKey: config.profilarrApiKey !== null,
		apiAreas: API_AREAS
	};
}

export const load: ServerLoad = async ({ cookies }) => {
	const currentSessionId = cookies.get('session');
	const user = usersQueries.getByUsername('admin') ?? usersQueries.getById(1);

	if (!user) {
		return {
			sessions: [],
			...loadApiKeys(),
			currentSessionId: null
		};
	}

	const sessions = sessionsQueries.getByUserId(user.id);

	return {
		sessions: sessions.map((s) => ({
			id: s.id,
			created_at: s.created_at,
			expires_at: s.expires_at,
			last_active_at: s.last_active_at,
			ip_address: s.ip_address,
			browser: s.browser,
			os: s.os,
			device_type: s.device_type,
			isCurrent: s.id === currentSessionId
		})),
		...loadApiKeys(),
		currentSessionId
	};
};

export const actions: Actions = {
	changePassword: async ({ request, cookies }) => {
		const formData = await request.formData();
		const currentPassword = formData.get('currentPassword') as string;
		const newPassword = formData.get('newPassword') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		if (!currentPassword || !newPassword || !confirmPassword) {
			return fail(400, { passwordError: 'All fields are required' });
		}

		if (newPassword.length < 8) {
			return fail(400, { passwordError: 'New password must be at least 8 characters' });
		}

		if (newPassword !== confirmPassword) {
			return fail(400, { passwordError: 'Passwords do not match' });
		}

		// Get current user from session
		const sessionId = cookies.get('session');
		if (!sessionId) {
			return fail(401, { passwordError: 'Not authenticated' });
		}

		const session = sessionsQueries.getValidById(sessionId);
		if (!session) {
			return fail(401, { passwordError: 'Invalid session' });
		}

		const user = usersQueries.getById(session.user_id);
		if (!user) {
			return fail(401, { passwordError: 'User not found' });
		}

		// Verify current password
		const valid = await verifyPassword(currentPassword, user.password_hash);
		if (!valid) {
			return fail(400, { passwordError: 'Current password is incorrect' });
		}

		// Update password
		const newHash = await hashPassword(newPassword);
		usersQueries.updatePassword(user.id, newHash);

		await logger.info(`Password changed for '${user.username}'`, {
			source: 'Auth',
			meta: { userId: user.id, username: user.username }
		});

		return { passwordSuccess: true };
	},

	deleteApiKey: async ({ request }) => {
		const formData = await request.formData();
		const id = Number(formData.get('id'));

		if (!Number.isInteger(id) || id < 1) {
			return fail(400, { apiKeyError: 'Invalid API key' });
		}

		const apiKey = apiKeysQueries.getById(id);
		if (!apiKey) {
			return fail(404, { apiKeyError: 'API key not found' });
		}

		apiKeysQueries.delete(id);

		await logger.info(`API key '${apiKey.name}' deleted`, {
			source: 'Auth:APIKey',
			meta: { id, name: apiKey.name }
		});

		return { apiKeyDeleted: apiKey.name };
	},

	revokeSession: async ({ request, cookies }) => {
		const formData = await request.formData();
		const sessionId = formData.get('sessionId') as string;
		const currentSessionId = cookies.get('session');

		if (!sessionId) {
			return fail(400, { sessionError: 'Session ID required' });
		}

		if (sessionId === currentSessionId) {
			return fail(400, { sessionError: 'Cannot revoke current session' });
		}

		sessionsQueries.deleteById(sessionId);

		await logger.info('Session revoked', {
			source: 'Auth:Session',
			meta: { revokedSessionId: sessionId.slice(0, 8) + '...' }
		});

		return { sessionRevoked: true };
	},

	revokeOtherSessions: async ({ cookies }) => {
		const currentSessionId = cookies.get('session');
		if (!currentSessionId) {
			return fail(401, { sessionError: 'Not authenticated' });
		}

		const session = sessionsQueries.getValidById(currentSessionId);
		if (!session) {
			return fail(401, { sessionError: 'Invalid session' });
		}

		const count = sessionsQueries.deleteOthersByUserId(session.user_id, currentSessionId);

		if (count > 0) {
			await logger.info(`Revoked ${count} other session${count === 1 ? '' : 's'}`, {
				source: 'Auth:Session',
				meta: { userId: session.user_id, count }
			});
		}

		return { sessionsRevoked: count };
	}
};
