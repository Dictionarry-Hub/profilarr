import type { Actions, ServerLoad } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import { config } from '$config';
import { usersQueries } from '$db/queries/users.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { authSettingsQueries } from '$db/queries/authSettings.ts';
import { hashPassword } from '$auth/password.ts';
import { needsSetup, validateNewLocalAccount } from '$auth/loginOptions.ts';
import { getClientIp } from '$auth/network.ts';
import { parseUserAgent } from '$auth/userAgent.ts';
import { logger } from '$logger/logger.ts';

function setupOpen(): boolean {
	return needsSetup({
		authMode: config.authMode,
		oidcEnabled: config.oidcEnabled,
		hasLocalAccount: usersQueries.existsLocal()
	});
}

export const load: ServerLoad = () => {
	// Setup is only open with AUTH=on, no SSO, and no password account yet.
	// With SSO configured, the first user signs in with SSO instead.
	if (!setupOpen()) {
		throw redirect(303, '/');
	}

	return {};
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies } = event;

		// Re-check inside the action (race condition protection)
		if (!setupOpen()) {
			void logger.warn('Setup attempt while setup is closed', {
				source: 'Auth:Setup',
				meta: { ip: getClientIp(event, false) }
			});
			throw redirect(303, '/');
		}

		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;
		const confirmPassword = formData.get('confirmPassword') as string;

		const validationError = validateNewLocalAccount(
			username ?? '',
			password ?? '',
			confirmPassword
		);
		if (validationError) {
			return fail(400, { error: validationError, username });
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
