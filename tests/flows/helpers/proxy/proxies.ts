/**
 * Every reverse proxy the flow suite can put in front of an app. A test picks
 * one with `test.use({ appProxy: { ... } })`; the browser then only talks to the
 * proxy, and the app's `ORIGIN` is the proxy's address, as in a real setup.
 *
 * `fake` runs in the test process and can fail on purpose. `traefik` runs
 * Traefik in a container (`needsDocker: true`); its tests are the scenarios
 * that run behind it through `proxySetups()`, not a helper spec.
 */

import { fakeProxy } from './fakeProxy.ts';
import { nginxProxyManager } from './nginxProxyManager.ts';
import { swag } from './swag.ts';
import { traefik } from './traefik.ts';

export interface ProxyOptions {
	/** Which proxy; default `fake` */
	id?: string;
	/** Serve HTTPS with the run's self-signed certificate */
	tls?: boolean;
	/**
	 * Hostname in the browser-facing URL; the listener still binds to
	 * 127.0.0.1. `profilarr.test` resolves there inside the test container
	 * (scripts/flows/run.ts) for proxies that reserve `localhost`, such as
	 * Nginx Proxy Manager's default server on port 443.
	 */
	publicHost?: '127.0.0.1' | 'localhost' | 'profilarr.test';
	/** Request headers to set on the way to the app; null strips one */
	headers?: Record<string, string | null>;
	/**
	 * Answer 502 when the app's response headers are larger than this many
	 * bytes, like nginx with a small `proxy_buffer_size`
	 */
	maxResponseHeaderBytes?: number;
	/**
	 * Ask the SSO provider before forwarding each request, and send the
	 * browser to its login page when it says no (forward auth). Needs
	 * `test.use({ ssoProvider })` with a provider that supports it.
	 */
	forwardAuth?: boolean;
}

/** An option, or `fail`, that a proxy may or may not support */
export type ProxyFeature = 'tls' | 'headers' | 'maxResponseHeaderBytes' | 'fail' | 'forwardAuth';

export interface ProxiedRequest {
	method: string;
	path: string;
	/** Headers as the app received them */
	headers: Record<string, string>;
	/** What the proxy answered the browser with */
	status: number;
}

export interface RunningProxy {
	proxy: ReverseProxy;
	/** The address the browser uses, also the app's `ORIGIN` */
	url: string;
	/** Start forwarding to the app at `appUrl`; until then requests fail */
	target(appUrl: string): Promise<void>;
	/** Every request the proxy handled, oldest first */
	requests: ProxiedRequest[];
	/** Answer every request with `status` instead of forwarding, or forward again with null */
	fail(status: number | null): void;
	/** Everything the proxy has printed, attached to a failed test */
	logs?(): Promise<string>;
	stop(): Promise<void>;
}

export interface ReverseProxy {
	id: string;
	label: string;
	/** True for proxies that run in a container, which needs the Docker socket */
	needsDocker: boolean;
	/** Only run in the focused origin matrix, not every existing proxy scenario */
	originOnly?: boolean;
	/** The options this proxy can honour; specs skip an option's tests on the others */
	supports: ProxyFeature[];
	/** `forwardAuthUrl` is the SSO provider's forward-auth endpoint, set with `forwardAuth` */
	start(options: ProxyOptions, forwardAuthUrl?: string): Promise<RunningProxy>;
}

/**
 * Whether a health request through a proxy reached the app: 200, or the 303
 * to first-run setup the app sends for every path while auth is on and no
 * account exists yet.
 */
export function answeredByApp(status: number): boolean {
	return status === 200 || status === 303;
}

export const PROXIES: ReverseProxy[] = [fakeProxy, traefik, nginxProxyManager, swag];

/** A proxy by id; an unknown id fails with the ids that exist */
export function reverseProxy(id: string): ReverseProxy {
	const found = PROXIES.find((candidate) => candidate.id === id);
	if (!found) {
		throw new Error(`No reverse proxy "${id}". Known: ${PROXIES.map((p) => p.id).join(', ')}`);
	}
	return found;
}

/** One way to reach the app: directly, or through one real proxy */
export interface ProxySetup {
	/** Names the setup in test titles, e.g. "no proxy" or "Traefik" */
	label: string;
	/** For `test.use({ appProxy })`; undefined reaches the app directly */
	appProxy: ProxyOptions | undefined;
	/** The proxy, for tagging and skipping with helpers/core/realServices.ts */
	proxy: ReverseProxy | undefined;
}

/**
 * Every way a real user reaches the app: no proxy, then each real proxy over
 * HTTPS. Scenarios loop over these, so a new real proxy joins all of them.
 */
export function proxySetups(): ProxySetup[] {
	return [
		{ label: 'no proxy', appProxy: undefined, proxy: undefined },
		...PROXIES.filter((proxy) => proxy.needsDocker && !proxy.originOnly).map((proxy) => ({
			label: proxy.label,
			appProxy: { id: proxy.id, tls: true },
			proxy
		}))
	];
}
