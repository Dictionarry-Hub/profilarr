/**
 * Auth middleware utilities
 * Core auth logic - keeps hooks.server.ts thin
 */

import type { RequestEvent } from '@sveltejs/kit';
import { config } from '$config';
import { usersQueries, type User } from '$db/queries/users.ts';
import { sessionsQueries, type Session } from '$db/queries/sessions.ts';
import { authSettingsQueries } from '$db/queries/authSettings.ts';
import { isLocalAddress, getClientIp } from './network.ts';
import { logger } from '$logger/logger.ts';
export { isPublicPath } from './publicPaths.ts';

/**
 * Auth state returned by getAuthState
 */
export interface AuthState {
	needsSetup: boolean;
	user: User | null;
	session: Session | null;
	skipAuth: boolean; // true when AUTH=off or local bypass+local IP
}

/**
 * Get auth state from request
 * Checks auth mode, API key, and session cookie
 */
export async function getAuthState(event: RequestEvent): Promise<AuthState> {
	const hasLocalUsers = usersQueries.existsLocal();

	// AUTH=off - skip all auth (trust external proxy like Authelia/Authentik)
	if (config.authMode === 'off') {
		return {
			needsSetup: false,
			user: null,
			session: null,
			skipAuth: true
		};
	}

	// Check API key — works for all modes except AUTH=off
	const apiKey = event.request.headers.get('X-Api-Key');
	if (apiKey) {
		const ip = getClientIp(event, false);
		const endpoint = event.url.pathname;

		if (await authSettingsQueries.validateApiKey(apiKey)) {
			void logger.debug('API key authenticated', {
				source: 'Auth:APIKey',
				meta: { ip, endpoint }
			});
			return {
				needsSetup: false,
				user: { id: 0, username: 'api' } as User,
				session: null,
				skipAuth: false
			};
		} else {
			const maskedKey = apiKey.length > 4 ? `****${apiKey.slice(-4)}` : '****';
			void logger.warn('Invalid API key', {
				source: 'Auth:APIKey',
				meta: { ip, endpoint, key: maskedKey }
			});
		}
	}

	// Local bypass - skip auth for local IPs (DB-backed toggle)
	if (authSettingsQueries.isLocalBypassEnabled()) {
		const clientIp = getClientIp(event, false);
		if (isLocalAddress(clientIp)) {
			return {
				needsSetup: !hasLocalUsers,
				user: null,
				session: null,
				skipAuth: true
			};
		}
	}

	// AUTH=oidc - uses sessions but no local user/password
	if (config.authMode === 'oidc') {
		const sessionId = event.cookies.get('session');
		const session = sessionId ? (sessionsQueries.getValidById(sessionId) ?? null) : null;
		const user = session ? (usersQueries.getById(session.user_id) ?? null) : null;

		return {
			needsSetup: false,
			user,
			session,
			skipAuth: false
		};
	}

	// AUTH=on (default) - check session cookie
	const sessionId = event.cookies.get('session');
	const session = sessionId ? (sessionsQueries.getValidById(sessionId) ?? null) : null;
	const user = session ? (usersQueries.getById(session.user_id) ?? null) : null;

	return {
		needsSetup: !hasLocalUsers,
		user,
		session,
		skipAuth: false
	};
}

/**
 * Sliding expiration: extend session if past halfway point
 * Avoids DB write on every request while keeping active users logged in
 */
export function maybeExtendSession(session: Session): void {
	const durationHours = authSettingsQueries.getSessionDurationHours();
	const expiresAt = new Date(session.expires_at).getTime();
	const now = Date.now();
	const halfDuration = (durationHours * 60 * 60 * 1000) / 2;

	// Only extend if less than half the duration remains
	if (expiresAt - now < halfDuration) {
		sessionsQueries.extendExpiration(session.id, durationHours);
		void logger.debug('Session extended', {
			source: 'Auth:Session',
			meta: { userId: session.user_id }
		});
	}
}

/**
 * Clean expired sessions - call on startup
 */
export function cleanupExpiredSessions(): number {
	return sessionsQueries.deleteExpired();
}
