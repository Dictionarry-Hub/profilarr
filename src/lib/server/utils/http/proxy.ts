/**
 * Outbound proxy settings from the environment.
 *
 * Profilarr doesn't configure a proxy itself: Deno's fetch (including
 * Deno.createHttpClient clients) and git both read the standard proxy
 * variables directly. This only reports what they will pick up.
 */

/** Checked uppercase first, then lowercase, matching Deno */
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
	for (const variable of [name, name.toLowerCase()]) {
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
	// Deno treats a proxy without a scheme as http://
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

export function getProxyEnv(get: EnvGetter = (name) => Deno.env.get(name)): ProxyEnv {
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
