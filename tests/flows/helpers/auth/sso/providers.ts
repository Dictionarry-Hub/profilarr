/**
 * Every SSO provider the flow suite can sign in through. A provider gives the
 * app its OIDC settings and knows how to fill in its own login page; the rest
 * of an SSO sign-in is the app's and the same for every provider
 * (`signInWithSso` in helpers/auth/accounts.ts).
 *
 * `fake` runs in the test process and can misbehave on purpose. `authelia`
 * runs Authelia in a container (`needsDocker: true`,
 * helpers/core/realServices.ts); its tests are the scenarios in
 * scenarios/auth/sso/, not a helper spec.
 */

import type { Page } from '@playwright/test';
import { authelia } from '$flows/helpers/auth/sso/authelia.ts';
import { fakeOidc } from '$flows/helpers/auth/sso/fakeOidc.ts';

export interface SsoUser {
	/** What the user types on the provider's login page */
	username: string;
	/** What the user types as their password, for providers that ask for one */
	password?: string;
	/**
	 * The subject the provider puts in the ID token; the app's user id. Only
	 * providers that let the test choose it set this.
	 */
	sub?: string;
}

/** Ways the fake provider can break on purpose, for failure tests */
export type Misbehaviour = 'wrong-issuer' | 'expired-token' | 'wrong-nonce' | 'refuse-login';

/** What a provider may or may not support; the others throw when it's used */
export type SsoFeature = 'misbehave' | 'requests' | 'forwardAuth';

export interface SsoRequest {
	method: string;
	path: string;
	query: URLSearchParams;
	/** Form fields of a POST */
	form: URLSearchParams;
}

export interface RunningSso {
	provider: SsoProvider;
	/** The provider's own address, where the browser signs in */
	url: string;
	/**
	 * `OIDC_DISCOVERY_URL`, `OIDC_CLIENT_ID` and `OIDC_CLIENT_SECRET` for the
	 * app, plus anything else it needs, such as a certificate to trust
	 */
	env: Record<string, string>;
	/** Accounts the provider accepts */
	users: SsoUser[];
	/**
	 * Accept sign-ins for the app at `appOrigin`, the app's `ORIGIN`. The app
	 * fixture calls it once the app has started, because the address is only
	 * known then.
	 */
	target(appOrigin: string): Promise<void>;
	/**
	 * Sign `user` in on the provider's own login page, which the app or a
	 * forward-auth proxy has just sent the browser to. Returns once the
	 * provider has sent the browser back.
	 */
	signIn(page: Page, user?: SsoUser): Promise<void>;
	/** Every request the provider received, oldest first. Needs `requests`. */
	requests: SsoRequest[];
	/** Break the next sign-ins in one way, or behave again with null. Needs `misbehave`. */
	misbehave(kind: Misbehaviour | null): void;
	/**
	 * The endpoint a reverse proxy asks before forwarding each request
	 * (forward auth). Needs `forwardAuth`.
	 */
	forwardAuthUrl?: string;
	/** Everything the provider has printed, attached to a failed test */
	logs?(): Promise<string>;
	stop(): Promise<void>;
}

export interface SsoProvider {
	/** Picked with `test.use({ ssoProvider: '<id>' })` */
	id: string;
	label: string;
	/** True for providers that run in a container, which needs the Docker socket */
	needsDocker: boolean;
	/** True for providers served over HTTPS with the run's certificate */
	tls: boolean;
	/** The features this provider has; specs skip a feature's tests on the others */
	supports: SsoFeature[];
	start(): Promise<RunningSso>;
}

export const PROVIDERS: SsoProvider[] = [fakeOidc, authelia];

/** A provider by id; an unknown id fails with the ids that exist */
export function ssoProvider(id: string): SsoProvider {
	const found = PROVIDERS.find((candidate) => candidate.id === id);
	if (!found) {
		throw new Error(`No SSO provider "${id}". Known: ${PROVIDERS.map((p) => p.id).join(', ')}`);
	}
	return found;
}
