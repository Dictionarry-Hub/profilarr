/**
 * Parse the deployment's configured origins and select one for a request. This
 * runs before SvelteKit so its request URL, CSRF check, cookies and OIDC all
 * agree on the browser-facing origin. A host that matches none of them is
 * served from the request itself, so health probes and API clients on
 * internal names keep working whatever ORIGIN holds.
 */

const DEFAULT_PORT = { 'http:': '80', 'https:': '443' };

/** @typedef {{ origin: string; protocol: 'http' | 'https'; hostname: string; port: string; explicitPort: boolean; host: string }} AllowedOrigin */

/**
 * @param {string | undefined} raw
 * @returns {AllowedOrigin[]}
 */
export function parseOrigins(raw) {
	if (!raw?.trim()) return [];
	/** @type {AllowedOrigin[]} */
	const origins = [];
	const seen = new Set();
	for (const value of raw.split(',')) {
		const input = value.trim();
		if (!input) throw new Error('ORIGIN contains an empty value');
		let url;
		try {
			url = new URL(input);
		} catch {
			throw new Error(`ORIGIN contains an invalid URL: ${input}`);
		}
		if (url.protocol !== 'http:' && url.protocol !== 'https:') {
			throw new Error(`ORIGIN only supports http and https: ${input}`);
		}
		if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
			throw new Error(`ORIGIN values must contain only scheme, host and port: ${input}`);
		}
		if (seen.has(url.origin)) continue;
		seen.add(url.origin);
		origins.push({
			origin: url.origin,
			protocol: /** @type {'http' | 'https'} */ (url.protocol.slice(0, -1)),
			hostname: url.hostname.toLowerCase(),
			port: url.port || DEFAULT_PORT[url.protocol],
			explicitPort: url.port !== '',
			host: url.host
		});
	}
	return origins;
}

/**
 * @param {string | string[] | undefined} value
 * @returns {string | undefined}
 */
function lastHeader(value) {
	const item = Array.isArray(value) ? value.at(-1) : value;
	return item?.split(',').at(-1)?.trim();
}

/**
 * @param {string | undefined} value
 * @returns {'http' | 'https' | undefined}
 */
function protocol(value) {
	if (value === undefined) return undefined;
	const normalized = value.toLowerCase();
	return normalized === 'http' || normalized === 'https' ? normalized : undefined;
}

/**
 * @param {string | undefined} value
 * @returns {string | undefined}
 */
function port(value) {
	if (value === undefined) return undefined;
	if (!/^\d+$/.test(value)) return undefined;
	const number = Number(value);
	return number >= 1 && number <= 65535 ? String(number) : undefined;
}

/**
 * @param {string | undefined} value
 * @param {string | undefined} separatePort
 * @returns {{ hostname: string; port: string | undefined } | undefined}
 */
function authority(value, separatePort) {
	if (!value) return undefined;
	let url;
	try {
		url = new URL(`http://${value}`);
	} catch {
		return undefined;
	}
	if (url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
		return undefined;
	}
	if (url.port && separatePort && url.port !== separatePort) return undefined;
	return { hostname: url.hostname.toLowerCase(), port: url.port || separatePort };
}

/**
 * @param {AllowedOrigin[]} origins
 * @param {{ hostname: string; port: string | undefined } | undefined} candidate
 * @returns {AllowedOrigin[]}
 */
function matches(origins, candidate) {
	if (!candidate) return [];
	return origins.filter(
		(origin) =>
			origin.hostname === candidate.hostname &&
			(candidate.port ? origin.port === candidate.port : !origin.explicitPort)
	);
}

/**
 * @param {AllowedOrigin[]} candidates
 * @param {'http' | 'https' | undefined} forwardedProtocol
 * @param {'http' | 'https'} socketProtocol
 * @returns {AllowedOrigin | undefined}
 */
function select(candidates, forwardedProtocol, socketProtocol) {
	if (candidates.length === 1) return candidates[0];
	if (forwardedProtocol) {
		const forwarded = candidates.filter((candidate) => candidate.protocol === forwardedProtocol);
		if (forwarded.length === 1) return forwarded[0];
	}
	const socket = candidates.filter((candidate) => candidate.protocol === socketProtocol);
	return socket.length === 1 ? socket[0] : undefined;
}

/**
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {boolean} encrypted
 * @param {AllowedOrigin[]} origins
 * @returns {string | undefined}
 */
export function resolveOrigin(headers, encrypted, origins) {
	const socketProtocol = encrypted ? 'https' : 'http';
	const rawHost = lastHeader(headers.host);
	if (origins.length === 1) return origins[0].origin;
	if (origins.length > 1) {
		const listed = selectListed(headers, rawHost, socketProtocol, origins);
		if (listed) return listed;
	}
	// No list, or nothing in it matched: the request's own scheme and Host
	if (!rawHost) return undefined;
	try {
		return new URL(`${socketProtocol}://${rawHost}`).origin;
	} catch {
		return undefined;
	}
}

/**
 * The listed origin a request belongs to, matched on Host, or on
 * X-Forwarded-Host when a proxy rewrote Host. Malformed forwarded values are
 * ignored rather than trusted.
 * @param {Record<string, string | string[] | undefined>} headers
 * @param {string | undefined} rawHost
 * @param {'http' | 'https'} socketProtocol
 * @param {AllowedOrigin[]} origins
 * @returns {string | undefined}
 */
function selectListed(headers, rawHost, socketProtocol, origins) {
	const forwardedHost = lastHeader(headers['x-forwarded-host']);
	const forwardedProtocol = protocol(lastHeader(headers['x-forwarded-proto']));
	const forwardedPort = port(lastHeader(headers['x-forwarded-port']));

	if (forwardedHost) {
		const forwarded = select(
			matches(origins, authority(forwardedHost, forwardedPort)),
			forwardedProtocol,
			socketProtocol
		);
		if (forwarded) return forwarded.origin;
	}

	return select(matches(origins, authority(rawHost, undefined)), forwardedProtocol, socketProtocol)
		?.origin;
}
