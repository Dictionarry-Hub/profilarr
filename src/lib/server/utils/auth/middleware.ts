/**
 * Auth middleware utilities
 * Core auth logic - keeps hooks.server.ts thin
 */

import type { RequestEvent } from '@sveltejs/kit';
import { config } from '$config';
import { usersQueries, type User } from '$db/queries/users.ts';
import { sessionsQueries, type Session } from '$db/queries/sessions.ts';
import { authSettingsQueries } from '$db/queries/authSettings.ts';
import { getClientIp } from './network.ts';
import { resolveApiKey, type ResolvedApiKey } from './apiKeyAuth.ts';
import { needsSetup } from './loginOptions.ts';
import { logger } from '$logger/logger.ts';
export { isPublicPath } from './publicPaths.ts';

/**
 * Auth state returned by getAuthState
 */
export interface AuthState {
	needsSetup: boolean;
	user: User | null;
	session: Session | null;
	skipAuth: boolean; // true when AUTH=off
	apiKey: ResolvedApiKey | null; // set when authenticated by X-Api-Key
	apiKeyExpired: boolean; // X-Api-Key matched a key that has expired
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
			skipAuth: true,
			apiKey: null,
			apiKeyExpired: false
		};
	}

	// Check API key — works for all modes except AUTH=off
	let apiKeyExpired = false;
	const apiKeyHeader = event.request.headers.get('X-Api-Key');
	if (apiKeyHeader) {
		const ip = getClientIp(event, false);
		const endpoint = event.url.pathname;
		const resolution = await resolveApiKey(apiKeyHeader);

		if (resolution.status === 'valid') {
			void logger.debug('API key authenticated', {
				source: 'Auth:APIKey',
				meta: { ip, endpoint, name: resolution.key.name }
			});
			return {
				needsSetup: false,
				user: { id: 0, username: 'api' } as User,
				session: null,
				skipAuth: false,
				apiKey: resolution.key,
				apiKeyExpired: false
			};
		}

		if (resolution.status === 'expired') {
			apiKeyExpired = true;
			void logger.warn('Expired API key', {
				source: 'Auth:APIKey',
				meta: { ip, endpoint, name: resolution.key.name }
			});
		} else {
			const maskedKey = apiKeyHeader.length > 4 ? `****${apiKeyHeader.slice(-4)}` : '****';
			void logger.warn('Invalid API key', {
				source: 'Auth:APIKey',
				meta: { ip, endpoint, key: maskedKey }
			});
		}
	}

	// AUTH=on (default) - check session cookie. Password and SSO sign-ins
	// both create sessions, so they're checked the same way.
	const sessionId = event.cookies.get('session');
	const session = sessionId ? (sessionsQueries.getValidById(sessionId) ?? null) : null;
	const user = session ? (usersQueries.getById(session.user_id) ?? null) : null;

	return {
		needsSetup: needsSetup({
			authMode: config.authMode,
			oidcEnabled: config.oidcEnabled,
			hasLocalAccount: hasLocalUsers
		}),
		user,
		session,
		skipAuth: false,
		apiKey: null,
		apiKeyExpired
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
