/**
 * Every reverse proxy the flow suite can put in front of an app. A test picks
 * one with `test.use({ appProxy: { ... } })`; the browser then only talks to the
 * proxy, and the app's `ORIGIN` is the proxy's address, as in a real setup.
 *
 * `fake` runs in the test process. Real proxies, such as Traefik, Caddy,
 * nginx or Nginx Proxy Manager in a container, join as more entries with
 * `needsDocker: true`.
 */

import { fakeProxy } from '$flows/helpers/proxy/fakeProxy.ts';

export interface ProxyOptions {
	/** Which proxy; default `fake` */
	id?: string;
	/** Serve HTTPS with the run's self-signed certificate */
	tls?: boolean;
	/** Request headers to set on the way to the app; null strips one */
	headers?: Record<string, string | null>;
	/**
	 * Answer 502 when the app's response headers are larger than this many
	 * bytes, like nginx with a small `proxy_buffer_size`
	 */
	maxResponseHeaderBytes?: number;
}

/** An option, or `fail`, that a proxy may or may not support */
export type ProxyFeature = 'tls' | 'headers' | 'maxResponseHeaderBytes' | 'fail';

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
	/** Start forwarding to the app at `appUrl`; until then every request gets 502 */
	target(appUrl: string): void;
	/** Every request the proxy handled, oldest first */
	requests: ProxiedRequest[];
	/** Answer every request with `status` instead of forwarding, or forward again with null */
	fail(status: number | null): void;
	stop(): Promise<void>;
}

export interface ReverseProxy {
	id: string;
	label: string;
	/** True for proxies that run in a container, which needs the Docker socket */
	needsDocker: boolean;
	/** The options this proxy can honour; specs skip an option's tests on the others */
	supports: ProxyFeature[];
	start(options: ProxyOptions): Promise<RunningProxy>;
}

export const PROXIES: ReverseProxy[] = [fakeProxy];

/** A proxy by id; an unknown id fails with the ids that exist */
export function reverseProxy(id: string): ReverseProxy {
	const found = PROXIES.find((candidate) => candidate.id === id);
	if (!found) {
		throw new Error(`No reverse proxy "${id}". Known: ${PROXIES.map((p) => p.id).join(', ')}`);
	}
	return found;
}
