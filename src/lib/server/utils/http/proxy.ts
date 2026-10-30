/**
 * Outbound proxy settings from the environment.
 *
 * Profilarr doesn't configure a proxy itself: Bun's fetch and git both read
 * the standard proxy variables directly. This reports what they will pick up,
 * and finds SOCKS proxies, which Bun's fetch can't use.
 */

import process from 'node:process';

/** Checked lowercase first, then uppercase, matching Bun */
const PROXY_VARS = ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY'];

export interface ProxyEnv {
	/**
	 * Variable name as set (e.g. HTTPS_PROXY or https_proxy) mapped to its URL
	 * with any login masked, or null if the URL couldn't be parsed
	 */
	proxies: Record<string, string | null>;
	noProxy: string[];
}

type EnvGetter = (name: string) => string | undefined;

function readVar(get: EnvGetter, name: string): { variable: string; value: string } | null {
	for (const variable of [name.toLowerCase(), name]) {
		const value = get(variable)?.trim();
		if (value) return { variable, value };
	}
	return null;
}

/**
 * Reduce a proxy URL to scheme://host:port, with any login replaced by ***.
 * The raw value is never returned because it may contain credentials.
 */
function maskProxyUrl(value: string): string | null {
	// Bun treats a proxy without a scheme as http://
	const withScheme = value.includes('://') ? value : `http://${value}`;
	try {
		const parsed = new URL(withScheme);
		if (!parsed.host) return null;
		const login = parsed.username || parsed.password ? '***@' : '';
		return `${parsed.protocol}//${login}${parsed.host}`;
	} catch {
		return null;
	}
}

export function getProxyEnv(get: EnvGetter = (name) => process.env[name]): ProxyEnv {
	const proxies: Record<string, string | null> = {};
	for (const name of PROXY_VARS) {
		const entry = readVar(get, name);
		if (entry) proxies[entry.variable] = maskProxyUrl(entry.value);
	}

	const noProxy = readVar(get, 'NO_PROXY')?.value.split(',') ?? [];

	return {
		proxies,
		noProxy: noProxy.map((host) => host.trim()).filter(Boolean)
	};
}

/**
 * Bun's fetch can't use a SOCKS proxy. Through HTTP_PROXY or HTTPS_PROXY every
 * request fails, and through ALL_PROXY requests skip the proxy without a
 * warning. Returns an error naming each variable, in either case, that sets
 * one, or null. The error never includes the proxy URL, which may hold a login.
 */
export function getSocksProxyError(get: EnvGetter = (name) => process.env[name]): string | null {
	const socks: string[] = [];
	for (const name of PROXY_VARS) {
		for (const variable of [name.toLowerCase(), name]) {
			if (/^socks/i.test(get(variable)?.trim() ?? '')) socks.push(variable);
		}
	}
	if (socks.length === 0) return null;

	const verb = socks.length === 1 ? 'sets' : 'set';
	return `${socks.join(', ')} ${verb} a SOCKS proxy, which Profilarr can't use. Set an HTTP proxy instead, such as gluetun's http://gluetun:8888.`;
}
