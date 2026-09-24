/**
 * Outbound proxy settings from the environment.
 *
 * Profilarr doesn't configure a proxy itself: Deno's fetch (including
 * Deno.createHttpClient clients) and git both read the standard proxy
 * variables directly. This only reports what they will pick up.
 */

/** Checked uppercase first, then lowercase, matching Deno */
const PROXY_VARS = ['HTTPS_PROXY', 'HTTP_PROXY', 'ALL_PROXY'];

export interface ProxySetting {
	/** Variable name as set, e.g. HTTPS_PROXY or https_proxy */
	variable: string;
	/** scheme://host:port with credentials removed, or null if it couldn't be parsed */
	url: string | null;
	/** Whether the URL includes a username or password */
	auth: boolean;
}

export interface ProxyEnv {
	proxies: ProxySetting[];
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
 * Reduce a proxy URL to scheme://host:port. The raw value is never returned
 * because it may contain credentials.
 */
function stripCredentials(value: string): { url: string | null; auth: boolean } {
	// Deno treats a proxy without a scheme as http://
	const withScheme = value.includes('://') ? value : `http://${value}`;
	try {
		const parsed = new URL(withScheme);
		if (!parsed.host) return { url: null, auth: false };
		return {
			url: `${parsed.protocol}//${parsed.host}`,
			auth: parsed.username !== '' || parsed.password !== ''
		};
	} catch {
		return { url: null, auth: false };
	}
}

export function getProxyEnv(get: EnvGetter = (name) => Deno.env.get(name)): ProxyEnv {
	const proxies: ProxySetting[] = [];
	for (const name of PROXY_VARS) {
		const entry = readVar(get, name);
		if (entry) proxies.push({ variable: entry.variable, ...stripCredentials(entry.value) });
	}

	const noProxy = readVar(get, 'NO_PROXY')?.value.split(',') ?? [];

	return {
		proxies,
		noProxy: noProxy.map((host) => host.trim()).filter(Boolean)
	};
}
