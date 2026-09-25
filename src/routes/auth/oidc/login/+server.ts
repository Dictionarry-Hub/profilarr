import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$config';
import { getDiscoveryDocument, generateState, buildAuthorizationUrl } from '$auth/oidc.ts';
import { getClientIp } from '$auth/network.ts';
import { logger } from '$logger/logger.ts';

export const GET: RequestHandler = async (event) => {
	const { cookies } = event;
	const ip = getClientIp(event, false);

	// SSO is enabled when all three OIDC settings are present (checked at startup)
	if (!config.oidcEnabled || !config.oidc.discoveryUrl || !config.oidc.clientId) {
		throw error(400, 'OIDC authentication is not enabled');
	}

	await logger.debug('OIDC flow started', {
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

	// Build authorization URL and redirect
	const authUrl = buildAuthorizationUrl(discovery.authorization_endpoint, {
		clientId: config.oidc.clientId,
		redirectUri: `${config.origin}/auth/oidc/callback`,
		state,
		nonce
	});

	throw redirect(302, authUrl);
};
