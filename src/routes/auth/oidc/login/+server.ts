import { redirect, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { config } from '$config';
import { getDiscoveryDocument, generateState, buildAuthorizationUrl } from '$auth/oidc.ts';
import { getClientIp } from '$auth/network.ts';
import { logger } from '$logger/logger.ts';

export const GET: RequestHandler = async (event) => {
	const { cookies } = event;
	const ip = getClientIp(event, false);

	// Validate OIDC configuration
	if (config.authMode !== 'oidc') {
		throw error(400, 'OIDC authentication is not enabled');
	}

	if (!config.oidc.discoveryUrl || !config.oidc.clientId || !config.oidc.clientSecret) {
		const missing = [
			!config.oidc.discoveryUrl && 'OIDC_DISCOVERY_URL',
			!config.oidc.clientId && 'OIDC_CLIENT_ID',
			!config.oidc.clientSecret && 'OIDC_CLIENT_SECRET'
		].filter(Boolean);

		await logger.error(`OIDC config missing: ${missing.join(', ')}`, {
			source: 'Auth:OIDC',
			meta: { missing }
		});
		throw error(
			500,
			'OIDC is not configured. Set OIDC_DISCOVERY_URL, OIDC_CLIENT_ID, and OIDC_CLIENT_SECRET'
		);
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
