/**
 * OIDC helpers for integration tests that sign in through mock-oauth2-server
 * (see tests/integration/auth/docker-compose.yml).
 */

import { assertEquals, assertStringIncludes } from '@std/assert';
import type { TestClient } from './client.ts';

export const MOCK_OIDC_URL = 'http://localhost:9090/default/.well-known/openid-configuration';

/** The three settings that turn SSO on */
export const OIDC_SETTINGS = {
	OIDC_DISCOVERY_URL: MOCK_OIDC_URL,
	OIDC_CLIENT_ID: 'profilarr',
	OIDC_CLIENT_SECRET: 'secret'
};

/**
 * Drive the full OIDC login flow through the mock server.
 *
 * 1. GET /auth/oidc/login → 302 to mock-oauth2-server authorize endpoint
 * 2. GET the authorize URL → 200 with HTML login form
 * 3. POST the form with the username → 302 back to our callback
 * 4. GET the callback URL → 303 redirect to /
 *
 * The mock server uses the submitted username as the `sub` claim, so the
 * Profilarr user is stored as `oidc:<username>`.
 *
 * Returns the callback response. The client's cookie jar will have
 * the session cookie if the flow succeeded.
 */
export async function completeOidcLogin(
	client: TestClient,
	username = 'test'
): Promise<{ callbackRes: Response; authUrl: string }> {
	// Step 1: Start OIDC flow
	const loginRes = await client.get('/auth/oidc/login');
	assertEquals(loginRes.status, 302, 'OIDC login should redirect to provider');
	const authUrl = loginRes.headers.get('location')!;

	// Step 2: Follow redirect to mock-oauth2-server (get login form)
	const formRes = await client.get(authUrl);
	assertEquals(formRes.status, 200, 'Mock server should return login form');
	// Consume the body so the response is not left hanging
	await formRes.text();

	// Step 3: POST the login form (mock server accepts any username)
	const formPostRes = await client.postForm(authUrl, { username });
	assertEquals(formPostRes.status, 302, 'Mock server should redirect back to callback');
	const callbackUrl = formPostRes.headers.get('location')!;
	assertStringIncludes(callbackUrl, '/auth/oidc/callback', 'Redirect should target our callback');

	// Step 4: Follow the callback redirect
	const callbackRes = await client.get(callbackUrl);

	return { callbackRes, authUrl };
}
