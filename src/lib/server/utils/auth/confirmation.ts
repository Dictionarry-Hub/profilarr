/**
 * Identity confirmation for sensitive actions (creating an API key).
 *
 * A session records `confirmed_at`: the last time its owner proved who they
 * are. Signing in sets it. A password session refreshes it by re-entering the
 * password; an SSO session by signing in at the provider again. Ordinary
 * activity never touches it. See docs/backend/security.md, "Creating a Key".
 */

import { isOidcUsername } from './loginOptions.ts';

/** How long a confirmation is trusted, per session. */
export const CONFIRMATION_WINDOW_MINUTES = 30;

/**
 * Allowed difference between our clock and the provider's when checking that
 * a re-authentication happened after we asked for it.
 */
export const REAUTH_SKEW_SECONDS = 60;

/** Where an SSO re-authentication returns to. Fixed, so it can't be used as an open redirect. */
export const REAUTH_RETURN_PATH = '/settings/security/api-keys/new';

/** Where a failed SSO re-authentication returns to, with `?reauth=failed`. */
export const REAUTH_FAILED_PATH = '/settings/security';

/**
 * How a session must confirm before creating a key: `none` when it confirmed
 * recently (or there is no session, i.e. AUTH=off), `password` for password
 * sessions, `sso` for SSO sessions.
 */
export type Confirmation = 'none' | 'password' | 'sso';

export function requiredConfirmation(
	session: { confirmed_at: string | null } | null | undefined,
	user: { username: string } | null | undefined
): Confirmation {
	if (!session || !user || isRecentlyConfirmed(session.confirmed_at)) return 'none';
	return isOidcUsername(user.username) ? 'sso' : 'password';
}

/**
 * True when `confirmedAt` is inside the confirmation window. A timestamp in
 * the future counts as confirmed, so clock skew can't lock anyone out.
 * Accepts ISO strings and SQLite's `YYYY-MM-DD HH:MM:SS`, read as UTC.
 */
export function isRecentlyConfirmed(
	confirmedAt: string | null | undefined,
	now: number = Date.now()
): boolean {
	if (!confirmedAt) return false;
	const normalized = /[zZ]$|[+-]\d{2}:\d{2}$/.test(confirmedAt)
		? confirmedAt
		: `${confirmedAt.replace(' ', 'T')}Z`;
	const at = Date.parse(normalized);
	if (Number.isNaN(at)) return false;
	return now - at <= CONFIRMATION_WINDOW_MINUTES * 60_000;
}

export type ReauthFailure = 'sub_mismatch' | 'no_auth_time' | 'stale_auth_time';

export interface ReauthInput {
	/** `sub` claim of the ID token the provider just issued */
	sub: string;
	/** `auth_time` claim of that token, if any; must be a number of seconds since the epoch */
	authTime: unknown;
	/** Username of the account behind the current session (`oidc:<sub>` for SSO) */
	sessionUsername: string;
	/** When we sent the person to the provider, in ms since the epoch */
	startedAt: number;
	now?: number;
}

/**
 * Decide whether a provider round trip counts as a fresh confirmation of the
 * signed-in account. Fails closed: a missing or non-numeric `auth_time`
 * means the provider gave no proof it re-authenticated anyone.
 */
export function evaluateReauth(
	input: ReauthInput
): { ok: true } | { ok: false; reason: ReauthFailure } {
	if (input.sessionUsername !== `oidc:${input.sub}`) {
		return { ok: false, reason: 'sub_mismatch' };
	}
	if (typeof input.authTime !== 'number' || !Number.isFinite(input.authTime)) {
		return { ok: false, reason: 'no_auth_time' };
	}
	const authTimeMs = input.authTime * 1000;
	if (authTimeMs < input.startedAt - REAUTH_SKEW_SECONDS * 1000) {
		return { ok: false, reason: 'stale_auth_time' };
	}
	return { ok: true };
}
