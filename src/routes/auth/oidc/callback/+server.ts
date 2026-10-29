import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '#utils/config/config.ts';
import { getDiscoveryDocument, exchangeCode, verifyAndDecodeIdToken } from '#utils/auth/oidc.ts';
import { usersQueries } from '#db/queries/users.ts';
import { sessionsQueries } from '#db/queries/sessions.ts';
import { authSettingsQueries } from '#db/queries/authSettings.ts';
import { getClientIp } from '#utils/auth/network.ts';
import { parseUserAgent } from '#utils/auth/userAgent.ts';
import {
	evaluateReauth,
	REAUTH_FAILED_PATH,
	REAUTH_RETURN_PATH
} from '#utils/auth/confirmation.ts';
import { logger } from '#logger/logger.ts';

export const GET: RequestHandler = async (event) => {
	const { url, cookies, request } = event;

	// SSO is enabled when all three OIDC settings are present (checked at startup)
	if (!config.oidcEnabled) {
		throw error(400, 'OIDC authentication is not enabled');
	}

	// Get code and state from query params
	const code = url.searchParams.get('code');
	const state = url.searchParams.get('state');
	const errorParam = url.searchParams.get('error');
	const errorDescription = url.searchParams.get('error_description');

	// Handle provider errors
	if (errorParam) {
		throw error(400, `OIDC error: ${errorParam} - ${errorDescription || 'Unknown error'}`);
	}

	// Verify state (CSRF protection)
	const savedState = cookies.get('oidc_state');
	if (!state || state !== savedState) {
		const ip = getClientIp(event, false);
		await logger.warn('OIDC state mismatch (possible CSRF attempt)', {
			source: 'Auth:OIDC',
			meta: { ip }
		});
		throw error(400, 'Invalid state parameter');
	}
	const savedNonce = cookies.get('oidc_nonce');
	// Only a value set by /auth/oidc/login?reauth=1 counts; a cleared cookie is not a re-auth
	const reauthStartedAt = cookies.get('oidc_reauth') || undefined;
	cookies.delete('oidc_state', { path: '/' });
	cookies.delete('oidc_nonce', { path: '/' });
	cookies.delete('oidc_reauth', { path: '/' });

	// Verify we have a code
	if (!code) {
		throw error(400, 'No authorization code provided');
	}

	// Validate OIDC configuration
	if (!config.oidc.discoveryUrl || !config.oidc.clientId || !config.oidc.clientSecret) {
		throw error(500, 'OIDC is not configured');
	}

	// Fetch discovery document
	const discovery = await getDiscoveryDocument(config.oidc.discoveryUrl);

	// Exchange code for tokens
	const ip = getClientIp(event, false);
	let tokens;
	try {
		tokens = await exchangeCode(discovery.token_endpoint, code, {
			clientId: config.oidc.clientId,
			clientSecret: config.oidc.clientSecret,
			redirectUri: `${config.origin}/auth/oidc/callback`
		});
	} catch (err) {
		await logger.warn('OIDC token exchange failed', {
			source: 'Auth:OIDC',
			meta: { ip, error: err instanceof Error ? err.message : String(err) }
		});
		throw error(500, 'Failed to exchange authorization code');
	}

	// Verify signature and decode ID token
	let claims;
	try {
		claims = await verifyAndDecodeIdToken(tokens.id_token, discovery.jwks_uri, {
			clientId: config.oidc.clientId,
			issuer: discovery.issuer
		});
	} catch (err) {
		await logger.error('OIDC ID token verification failed', {
			source: 'Auth:OIDC',
			meta: { ip, error: err instanceof Error ? err.message : String(err) }
		});
		throw error(500, 'Failed to verify ID token');
	}

	// Verify nonce (token replay protection)
	if (!savedNonce || claims.nonce !== savedNonce) {
		await logger.warn('OIDC nonce mismatch (possible token replay)', {
			source: 'Auth:OIDC',
			meta: { ip }
		});
		throw error(400, 'Invalid nonce parameter');
	}

	// Re-authentication: confirm the existing session instead of signing in.
	// The session must still be valid, belong to the account the provider just
	// authenticated, and the provider must say the authentication is fresh.
	if (reauthStartedAt !== undefined) {
		const sessionId = cookies.get('session');
		const session = sessionId ? sessionsQueries.getValidById(sessionId) : undefined;
		const user = session ? usersQueries.getById(session.user_id) : undefined;
		if (!session || !user) {
			throw error(400, 'Re-authentication needs a signed-in SSO session');
		}

		const result = evaluateReauth({
			sub: claims.sub,
			authTime: claims.auth_time,
			sessionUsername: user.username,
			startedAt: Number(reauthStartedAt)
		});

		if (!result.ok && result.reason === 'sub_mismatch') {
			await logger.warn('OIDC re-authentication signed in a different account', {
				source: 'Auth:OIDC',
				meta: { ip, username: user.username }
			});
			throw error(400, 'Re-authentication did not match the signed-in account');
		}

		if (!result.ok) {
			await logger.warn(`OIDC re-authentication could not be confirmed: ${result.reason}`, {
				source: 'Auth:OIDC',
				meta: { ip, username: user.username, reason: result.reason }
			});
			throw redirect(303, `${REAUTH_FAILED_PATH}?reauth=failed`);
		}

		sessionsQueries.markConfirmed(session.id);
		await logger.info(`OIDC re-authentication confirmed '${claims.sub}'`, {
			source: 'Auth:OIDC',
			meta: { sub: claims.sub, ip }
		});
		throw redirect(303, REAUTH_RETURN_PATH);
	}

	// Get or create OIDC user (using 'sub' as unique identifier)
	const userId = usersQueries.getOrCreateOidcUser(claims.sub);

	// Capture session metadata
	const ipAddress = getClientIp(event);
	const userAgent = request.headers.get('user-agent') ?? '';
	const parsed = parseUserAgent(userAgent);

	// Create session
	const durationHours = authSettingsQueries.getSessionDurationHours();
	const sessionId = sessionsQueries.create(userId, durationHours, {
		ipAddress,
		userAgent,
		browser: parsed.browser,
		os: parsed.os,
		deviceType: parsed.deviceType
	});

	await logger.info(`OIDC login successful for '${claims.sub}'`, {
		source: 'Auth:OIDC',
		meta: { sub: claims.sub, ip: ipAddress, browser: parsed.browser, device: parsed.deviceType }
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
};
