/**
 * E2E tests: OIDC login flow
 *
 * Tests the full browser-level OIDC experience using mock-oauth2-server.
 * Validates that the login page renders correctly, the SSO button works,
 * the redirect chain completes, and the user ends up authenticated.
 *
 * Tests:
 * 1. Direct — full OIDC flow authenticates the user
 * 2. Proxy — full OIDC flow through Caddy reverse proxy
 */
import { test, expect } from '@playwright/test';

const DIRECT_URL = process.env.OIDC_DIRECT_URL || 'http://localhost:7006';
const PROXY_URL = process.env.OIDC_PROXY_URL || 'https://localhost:7445';

/**
 * Drive the full OIDC login flow in the browser.
 *
 * 1. Navigate to app → redirected to /auth/login
 * 2. See "Sign in with SSO" button → click it
 * 3. Redirected to mock-oauth2-server → fill username → submit
 * 4. Redirected back to app → authenticated
 */
async function oidcLogin(page: import('@playwright/test').Page, appUrl: string) {
	// Navigate to app — unauthenticated, should end up at login page
	await page.goto(appUrl);
	await expect(page.getByText('Sign in with SSO')).toBeVisible();

	// Click SSO button — starts OIDC authorization flow
	await page.getByText('Sign in with SSO').click();

	// Should land on mock-oauth2-server login form
	await page.waitForURL(/localhost:9090/);

	// Fill username and submit (mock server accepts any username)
	await page.fill('input[name="username"]', 'e2e-user');
	await page.locator('input[type="submit"]').click();

	// Should redirect back to app after callback processing
	const escapedUrl = appUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	await page.waitForURL(new RegExp(escapedUrl));
}

test.describe('OIDC login', () => {
	test('direct — full OIDC flow authenticates the user', async ({ page }) => {
		await oidcLogin(page, DIRECT_URL);

		// Should be on the home page, not the login page
		await expect(page.getByText('Sign in with SSO')).not.toBeVisible();

		// Verify authenticated access works
		await page.goto(`${DIRECT_URL}/databases`);
		await expect(page).not.toHaveURL(/auth\/login/);
	});

	test('proxy — full OIDC flow through reverse proxy', async ({ page }) => {
		await oidcLogin(page, PROXY_URL);

		// Should be on the home page, not the login page
		await expect(page.getByText('Sign in with SSO')).not.toBeVisible();

		// Verify authenticated access works through proxy
		await page.goto(`${PROXY_URL}/databases`);
		await expect(page).not.toHaveURL(/auth\/login/);
	});
});
