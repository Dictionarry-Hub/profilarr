import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$config';
import { getDiscoveryDocument, exchangeCode, verifyAndDecodeIdToken } from '$auth/oidc.ts';
import { usersQueries } from '$db/queries/users.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { authSettingsQueries } from '$db/queries/authSettings.ts';
import { getClientIp } from '$auth/network.ts';
import { parseUserAgent } from '$auth/userAgent.ts';
import { logger } from '$logger/logger.ts';

export const GET: RequestHandler = async (event) => {
	const { url, cookies, request } = event;

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
	cookies.delete('oidc_state', { path: '/' });
	cookies.delete('oidc_nonce', { path: '/' });

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
