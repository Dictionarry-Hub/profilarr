import type { Actions, ServerLoad } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import { config } from '$config';
import { usersQueries } from '$db/queries/users.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { authSettingsQueries } from '$db/queries/authSettings.ts';
import { verifyPassword } from '$auth/password.ts';
import { getClientIp } from '$auth/network.ts';
import { parseUserAgent } from '$auth/userAgent.ts';
import { analyzeLoginFailure, formatLoginFailure } from '$auth/loginAnalysis.ts';
import { logger } from '$logger/logger.ts';

export const load: ServerLoad = () => {
	// OIDC mode - just show the OIDC button, no setup needed
	if (config.authMode === 'oidc') {
		return { authMode: 'oidc' };
	}

	// If no local users exist, redirect to setup
	// (OIDC users don't count - they can't login with password)
	if (!usersQueries.existsLocal()) {
		throw redirect(303, '/auth/setup');
	}

	return { authMode: config.authMode };
};

export const actions: Actions = {
	default: async (event) => {
		const { request, cookies } = event;
		const formData = await request.formData();
		const username = (formData.get('username') as string)?.trim();
		const password = formData.get('password') as string;

		// Validation
		if (!username || !password) {
			return fail(400, { error: 'Username and password are required', username });
		}

		// Find user
		const user = usersQueries.getByUsername(username);
		if (!user) {
			const ip = getClientIp(event);
			const allUsernames = usersQueries.getAllUsernames();
			const analysis = analyzeLoginFailure(username, allUsernames, false);

			await logger.warn(`Login failed for '${username}': ${formatLoginFailure(analysis)}`, {
				source: 'Auth:Login',
				meta: { username, ip, ...analysis }
			});
			return fail(400, { error: 'Invalid username or password', username });
		}

		// Verify password
		const valid = await verifyPassword(password, user.password_hash);
		if (!valid) {
			const ip = getClientIp(event);
			const analysis = analyzeLoginFailure(username, [], true);

			await logger.warn(`Login failed for '${username}': ${formatLoginFailure(analysis)}`, {
				source: 'Auth:Login',
				meta: { username, ip, ...analysis }
			});
			return fail(400, { error: 'Invalid username or password', username });
		}

		// Capture session metadata
		const ipAddress = getClientIp(event);
		const userAgent = request.headers.get('user-agent') ?? '';
		const parsed = parseUserAgent(userAgent);

		// Create session with metadata
		const durationHours = authSettingsQueries.getSessionDurationHours();
		const sessionId = sessionsQueries.create(user.id, durationHours, {
			ipAddress,
			userAgent,
			browser: parsed.browser,
			os: parsed.os,
			deviceType: parsed.deviceType
		});

		await logger.info(`Login successful for '${username}'`, {
			source: 'Auth:Login',
			meta: { username, ip: ipAddress, browser: parsed.browser, device: parsed.deviceType }
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
	}
};
