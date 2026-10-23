/**
 * Every SSO provider the flow suite can sign in through. A provider gives the
 * app its OIDC settings and knows how to fill in its own login page; the rest
 * of an SSO sign-in is the app's and the same for every provider
 * (`signInWithSso` in helpers/auth/accounts.ts).
 *
 * `fake` runs in the test process. Real providers, such as Authelia, run in a
 * container and join as entries with `needsDocker: true`
 * (helpers/core/realServices.ts). SSO specs loop over `PROVIDERS`, so a new
 * entry gets the existing tests.
 */

import type { Page } from '@playwright/test';
import { fakeOidc } from '$flows/helpers/auth/sso/fakeOidc.ts';

export interface SsoUser {
	/** What the user types on the provider's login page */
	username: string;
	/** The subject the provider puts in the ID token; the app's user id */
	sub: string;
}

/** Ways the fake provider can break on purpose, for failure tests */
export type Misbehaviour = 'wrong-issuer' | 'expired-token' | 'wrong-nonce' | 'refuse-login';

export interface SsoRequest {
	method: string;
	path: string;
	query: URLSearchParams;
	/** Form fields of a POST */
	form: URLSearchParams;
}

export interface RunningSso {
	provider: SsoProvider;
	/** `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` for the app */
	env: Record<string, string>;
	/** Accounts the provider accepts */
	users: SsoUser[];
	/**
	 * Sign `user` in on the provider's own login page, which the app has just
	 * sent the browser to. Returns once the provider has sent the browser back.
	 */
	signIn(page: Page, user?: SsoUser): Promise<void>;
	/** Every request the provider received, oldest first */
	requests: SsoRequest[];
	/** Break the next sign-ins in one way, or behave again with null */
	misbehave(kind: Misbehaviour | null): void;
	stop(): Promise<void>;
}

export interface SsoProvider {
	/** Picked with `test.use({ ssoProvider: '<id>' })` */
	id: string;
	label: string;
	/** True for providers that run in a container, which needs the Docker socket */
	needsDocker: boolean;
	start(): Promise<RunningSso>;
}

export const PROVIDERS: SsoProvider[] = [fakeOidc];

/** A provider by id; an unknown id fails with the ids that exist */
export function ssoProvider(id: string): SsoProvider {
	const found = PROVIDERS.find((candidate) => candidate.id === id);
	if (!found) {
		throw new Error(`No SSO provider "${id}". Known: ${PROVIDERS.map((p) => p.id).join(', ')}`);
	}
	return found;
}
