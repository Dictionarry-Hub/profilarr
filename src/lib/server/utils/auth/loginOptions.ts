/**
 * Login decisions: which sign-in methods to offer, when first-run setup is
 * open, and which accounts are SSO accounts.
 */

import type { AuthMode } from '$config';

/** SSO accounts are stored as `oidc:<sub>`. Matches SQL `LIKE 'oidc:%'`. */
const OIDC_USERNAME_PREFIX = /^oidc:/i;

export function isOidcUsername(username: string): boolean {
	return OIDC_USERNAME_PREFIX.test(username);
}

/**
 * Which sign-in methods the login page shows. The password form only appears
 * once a password account exists; the SSO button whenever SSO is configured.
 */
export function getLoginOptions(opts: { oidcEnabled: boolean; hasLocalAccount: boolean }): {
	password: boolean;
	sso: boolean;
} {
	return { password: opts.hasLocalAccount, sso: opts.oidcEnabled };
}

/**
 * First-run setup is only open when login is on, SSO isn't configured, and no
 * password account exists. With SSO configured, the first user signs in with
 * SSO instead, so setup is never left open to whoever reaches the page first.
 */
export function needsSetup(opts: {
	authMode: AuthMode;
	oidcEnabled: boolean;
	hasLocalAccount: boolean;
}): boolean {
	return opts.authMode === 'on' && !opts.oidcEnabled && !opts.hasLocalAccount;
}

/**
 * Why startup must stop, or null to start normally. SSO accounts exist but SSO
 * is no longer configured and there's no password account: nobody could sign
 * in, and opening first-run setup would let whoever reaches it first take over
 * an instance that was in use. Refuse to start until the OIDC settings are
 * restored, so a lost env file fails closed.
 */
export function getStartupAuthError(opts: {
	authMode: AuthMode;
	oidcEnabled: boolean;
	hasLocalAccount: boolean;
	hasSsoAccounts: boolean;
}): string | null {
	if (opts.authMode !== 'on' || opts.oidcEnabled || opts.hasLocalAccount || !opts.hasSsoAccounts) {
		return null;
	}
	return (
		"SSO accounts exist but the OIDC_* settings are missing, and there's no local password account. " +
		'Restore the OIDC settings, or create a local account in Settings > Security before removing SSO.'
	);
}

/**
 * Validate a new password account. Returns an error message, or null if valid.
 * Expects a trimmed username.
 */
export function validateNewLocalAccount(
	username: string,
	password: string,
	confirmPassword: string
): string | null {
	if (!username) return 'Username is required';
	if (username.length < 3) return 'Username must be at least 3 characters';
	// An oidc:-prefixed password account would be counted as an SSO account,
	// which could reopen first-run setup.
	if (isOidcUsername(username)) {
		return "Usernames starting with 'oidc:' are reserved for SSO accounts";
	}
	if (!password) return 'Password is required';
	if (password.length < 8) return 'Password must be at least 8 characters';
	if (password !== confirmPassword) return 'Passwords do not match';
	return null;
}
