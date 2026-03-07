import type { Actions, ServerLoad } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import { config } from '$config';
import { usersQueries } from '$db/queries/users.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { authSettingsQueries } from '$db/queries/authSettings.ts';
import { hashPassword } from '$auth/password.ts';
import { getClientIp } from '$auth/network.ts';
import { parseUserAgent } from '$auth/userAgent.ts';
import { logger } from '$logger/logger.ts';

export const load: ServerLoad = () => {
	// AUTH=off — no local auth, setup has no purpose
	if (config.authMode === 'off') {
		throw redirect(303, '/');
	}

	// If local users already exist, redirect to home
	// (OIDC users don't count - they need to create a local account to use password auth)
	if (usersQueries.existsLocal()) {
		throw redirect(303, '/');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies } = event;

		// AUTH=off — setup not allowed
		if (config.authMode === 'off') {
			throw redirect(303, '/');
		}

		// Double-check no local users exist (race condition protection)
		if (usersQueries.existsLocal()) {
			void logger.warn('Setup attempt after user already exists', {
				source: 'Auth:Setup',
				meta: { ip: getClientIp(event, false) }
			});
			throw redirect(303, '/');
		}

		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		// Validation
		if (!username) {
			return fail(400, { error: 'Username is required', username });
		}

		if (username.length < 3) {
			return fail(400, { error: 'Username must be at least 3 characters', username });
		}

		if (!password) {
			return fail(400, { error: 'Password is required', username });
		}

		if (password.length < 8) {
			return fail(400, { error: 'Password must be at least 8 characters', username });
		}

		if (password !== confirmPassword) {
			return fail(400, { error: 'Passwords do not match', username });
		}

		try {
			// Hash password and create user
			const passwordHash = await hashPassword(password);
			const userId = usersQueries.create(username, passwordHash);

			if (!userId) {
				return fail(500, { error: 'Failed to create account', username });
			}

			// Capture session metadata
			const ipAddress = getClientIp(event);
			const userAgent = request.headers.get('user-agent') ?? '';
			const parsed = parseUserAgent(userAgent);

			// Create session with metadata
			const durationHours = authSettingsQueries.getSessionDurationHours();
			const sessionId = sessionsQueries.create(userId, durationHours, {
				ipAddress,
				userAgent,
				browser: parsed.browser,
				os: parsed.os,
				deviceType: parsed.deviceType
			});

			await logger.info(`Account created: '${username}'`, {
				source: 'Auth',
				meta: { username, ip: ipAddress }
			});

			// Set session cookie
			const expires = new Date(Date.now() + durationHours * 60 * 60 * 1000);
			cookies.set('session', sessionId, {
				path: '/',
				httpOnly: true,
				sameSite: 'lax',
				secure: config.origin.startsWith('https://'),
				expires
			});

			// Redirect to home
			throw redirect(303, '/');
		} catch (err) {
			// Re-throw redirects
			if (err instanceof Response || (err && typeof err === 'object' && 'status' in err)) {
				throw err;
			}

			return fail(500, { error: 'Failed to create account', username });
		}
	}
};
