/**
 * Auth configuration parsing
 *
 * AUTH turns login on or off. SSO (OIDC) is an add-on to AUTH=on, enabled when
 * all three OIDC_* settings are present.
 */

export type AuthMode = 'on' | 'off';

export interface OidcSettings {
	discoveryUrl: string | null;
	clientId: string | null;
	clientSecret: string | null;
}

export interface AuthConfig {
	authMode: AuthMode;
	/** AUTH=oidc was used; it now means AUTH=on */
	deprecatedOidcMode: boolean;
	/** All three OIDC settings are present and login is on */
	oidcEnabled: boolean;
	oidc: OidcSettings;
}

const OIDC_KEYS = ['OIDC_DISCOVERY_URL', 'OIDC_CLIENT_ID', 'OIDC_CLIENT_SECRET'] as const;

/**
 * Parse AUTH and OIDC_* settings. Throws when some but not all OIDC settings
 * are set, so a typo can't silently turn SSO off and open first-run setup.
 */
export function parseAuthConfig(env: Record<string, string | undefined>): AuthConfig {
	const auth = (env.AUTH || 'on').toLowerCase();

	// TODO(v3.0.0): Remove the AUTH=oidc alias. Removing it is a breaking
	// change: an instance still on AUTH=oidc with no password account would
	// fall back to AUTH=on and open first-run setup to anyone who reaches it.
	const deprecatedOidcMode = auth === 'oidc';
	const authMode: AuthMode = auth === 'off' ? 'off' : 'on';

	const oidc: OidcSettings = {
		discoveryUrl: env.OIDC_DISCOVERY_URL || null,
		clientId: env.OIDC_CLIENT_ID || null,
		clientSecret: env.OIDC_CLIENT_SECRET || null
	};

	if (authMode === 'off') {
		return { authMode, deprecatedOidcMode, oidcEnabled: false, oidc };
	}

	const missing = OIDC_KEYS.filter((key) => !env[key]);
	// AUTH=oidc used to mean SSO only, with first-run setup closed. Without
	// the settings it would fall back to AUTH=on and open setup instead.
	if (deprecatedOidcMode && missing.length === OIDC_KEYS.length) {
		throw new Error(`AUTH=oidc requires ${OIDC_KEYS.join(', ')}.`);
	}
	if (missing.length > 0 && missing.length < OIDC_KEYS.length) {
		throw new Error(
			`OIDC is partially configured. Missing: ${missing.join(', ')}. ` +
				`Set all of ${OIDC_KEYS.join(', ')} to enable SSO, or remove them.`
		);
	}

	return { authMode, deprecatedOidcMode, oidcEnabled: missing.length === 0, oidc };
}
