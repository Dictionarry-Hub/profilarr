/**
 * Network utilities for extracting the client IP from a request
 */

/**
 * Headers to check for client IP, in order of precedence
 * Based on @supercharge/request-ip (used by Overseerr)
 */
const IP_HEADERS = [
	'x-forwarded-for', // Standard proxy header (may contain multiple IPs)
	'x-real-ip', // Nginx
	'x-client-ip', // Apache
	'cf-connecting-ip', // Cloudflare
	'fastly-client-ip', // Fastly
	'true-client-ip', // Akamai/Cloudflare
	'x-cluster-client-ip' // Rackspace
];

/**
 * Extract client IP from request
 * When trustProxy is true (default), checks proxy headers first for accurate logging.
 * When false, only uses the real TCP connection address.
 */
export function getClientIp(
	event: { getClientAddress: () => string; request: Request },
	trustProxy: boolean = true
): string {
	if (trustProxy) {
		const headers = event.request.headers;
		for (const header of IP_HEADERS) {
			const value = headers.get(header);
			if (value) {
				const ip = value.split(',')[0].trim();
				if (ip) return ip;
			}
		}
	}

	try {
		const address = event.getClientAddress();
		if (address && address !== 'unknown') {
			return address;
		}
	} catch {
		// Can throw during prerendering
	}

	return trustProxy ? '127.0.0.1' : '0.0.0.0';
}
