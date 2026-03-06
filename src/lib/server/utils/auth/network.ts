/**
 * Network utilities for detecting local/private IP addresses
 * Used for local bypass to skip auth for local network requests
 *
 * Based on Sonarr's implementation:
 * https://github.com/Sonarr/Sonarr/blob/develop/src/NzbDrone.Common/Extensions/IpAddressExtensions.cs
 */

/**
 * Check if an IP address is a local/private network address
 *
 * IPv4 ranges:
 * - 127.0.0.0/8    (loopback)
 * - 10.0.0.0/8     (Class A private)
 * - 172.16.0.0/12  (Class B private)
 * - 192.168.0.0/16 (Class C private)
 * - 169.254.0.0/16 (link-local, no DHCP)
 *
 * IPv6 ranges:
 * - ::1            (loopback)
 * - fe80::/10      (link-local)
 * - fc00::/7       (unique local)
 * - fec0::/10      (site-local, deprecated but still checked)
 */
export function isLocalAddress(ip: string): boolean {
	// Handle IPv6-mapped IPv4 (::ffff:192.168.1.1)
	if (ip.startsWith('::ffff:')) {
		ip = ip.slice(7);
	}

	// Check if it's an IPv4 address
	if (ip.includes('.')) {
		return isLocalIPv4(ip);
	}

	// IPv6 checks
	return isLocalIPv6(ip);
}

/**
 * Check if an IPv4 address is local/private
 */
function isLocalIPv4(ip: string): boolean {
	const parts = ip.split('.');
	if (parts.length !== 4) return false;

	const bytes = parts.map((p) => parseInt(p, 10));
	if (bytes.some((b) => isNaN(b) || b < 0 || b > 255)) return false;

	const [a, b] = bytes;

	// Loopback: 127.0.0.0/8
	if (a === 127) return true;

	// Class A private: 10.0.0.0/8
	if (a === 10) return true;

	// Class B private: 172.16.0.0/12 (172.16.x.x - 172.31.x.x)
	if (a === 172 && b >= 16 && b <= 31) return true;

	// Class C private: 192.168.0.0/16
	if (a === 192 && b === 168) return true;

	// Link-local: 169.254.0.0/16 (no DHCP assigned)
	if (a === 169 && b === 254) return true;

	return false;
}

/**
 * Check if an IPv6 address is local
 */
function isLocalIPv6(ip: string): boolean {
	const lower = ip.toLowerCase();

	// Loopback
	if (lower === '::1') return true;

	// Link-local: fe80::/10
	if (lower.startsWith('fe80:')) return true;

	// Unique local: fc00::/7 (fc00:: or fd00::)
	if (lower.startsWith('fc') || lower.startsWith('fd')) return true;

	// Site-local (deprecated): fec0::/10
	if (lower.startsWith('fec')) return true;

	return false;
}

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
