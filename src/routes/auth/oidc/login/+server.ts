import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$config';
import { getDiscoveryDocument, generateState, buildAuthorizationUrl } from '$auth/oidc.ts';
import { getClientIp } from '$auth/network.ts';
import { isOidcUsername } from '$auth/loginOptions.ts';
import { sessionsQueries } from '$db/queries/sessions.ts';
import { usersQueries } from '$db/queries/users.ts';
import { logger } from '$logger/logger.ts';

export const GET: RequestHandler = async (event) => {
	const { cookies, url } = event;
	const ip = getClientIp(event, false);

	// SSO is enabled when all three OIDC settings are present (checked at startup)
	if (!config.oidcEnabled || !config.oidc.discoveryUrl || !config.oidc.clientId) {
		throw error(400, 'OIDC authentication is not enabled');
	}

	// `?reauth=1` re-authenticates the signed-in SSO session instead of signing in.
	// The callback keeps that session and marks it confirmed (see $auth/confirmation.ts).
	const reauth = url.searchParams.get('reauth') === '1';
	if (reauth) {
		const sessionId = cookies.get('session');
		const session = sessionId ? sessionsQueries.getValidById(sessionId) : undefined;
		const user = session ? usersQueries.getById(session.user_id) : undefined;
		if (!session || !user || !isOidcUsername(user.username)) {
			throw error(400, 'Re-authentication needs a signed-in SSO session');
		}
	}

	await logger.debug(reauth ? 'OIDC re-authentication started' : 'OIDC flow started', {
		source: 'Auth:OIDC',
		meta: { ip }
	});

	// Fetch discovery document
	const discovery = await getDiscoveryDocument(config.oidc.discoveryUrl);

	// Generate state (CSRF) and nonce (token replay) tokens
	const state = generateState();
	const nonce = crypto.randomUUID();

	// Store state and nonce in cookies (10 minute expiry)
	const cookieOpts = {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: config.origin.startsWith('https://'),
		maxAge: 60 * 10
	};
	cookies.set('oidc_state', state, cookieOpts);
	cookies.set('oidc_nonce', nonce, cookieOpts);
	if (reauth) {
		// When we asked, so the callback can check the provider authenticated after this
		cookies.set('oidc_reauth', String(Date.now()), cookieOpts);
	} else {
		cookies.delete('oidc_reauth', { path: '/' });
	}

	// Build authorization URL and redirect
	const authUrl = buildAuthorizationUrl(discovery.authorization_endpoint, {
		clientId: config.oidc.clientId,
		redirectUri: `${config.origin}/auth/oidc/callback`,
		state,
		nonce,
		reauth
	});

	throw redirect(302, authUrl);
};
