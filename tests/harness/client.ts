/**
 * TestClient — fetch() wrapper with cookie jar for integration tests.
 * Automatically manages cookies across requests and defaults to redirect: 'manual'.
 */

import { log } from './log.ts';

interface Cookie {
	name: string;
	value: string;
	attributes: Record<string, string>;
}

export class TestClient {
	private baseUrl: string;
	private cookies: Map<string, Cookie> = new Map();

	constructor(baseUrl: string) {
		this.baseUrl = baseUrl;
	}

	/**
	 * GET request.
	 */
	async get(
		path: string,
		options: { headers?: Record<string, string>; followRedirects?: boolean } = {}
	): Promise<Response> {
		return this.request(path, {
			method: 'GET',
			headers: options.headers,
			followRedirects: options.followRedirects
		});
	}

	/**
	 * POST with JSON body.
	 */
	async post(
		path: string,
		body: Record<string, unknown>,
		options: { headers?: Record<string, string> } = {}
	): Promise<Response> {
		return this.request(path, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			body: JSON.stringify(body)
		});
	}

	/**
	 * POST with form data (application/x-www-form-urlencoded).
	 * SvelteKit form actions expect this format.
	 */
	async postForm(
		path: string,
		fields: Record<string, string>,
		options: { headers?: Record<string, string> } = {}
	): Promise<Response> {
		const body = new URLSearchParams(fields).toString();
		return this.request(path, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/x-www-form-urlencoded',
				...options.headers
			},
			body
		});
	}

	/**
	 * POST with multipart form data (file uploads).
	 * Content-Type is omitted so fetch sets the multipart boundary automatically.
	 */
	async postMultipart(
		path: string,
		formData: FormData,
		options: { headers?: Record<string, string> } = {}
	): Promise<Response> {
		return this.request(path, {
			method: 'POST',
			headers: options.headers,
			body: formData
		});
	}

	/**
	 * DELETE request.
	 */
	async delete(
		path: string,
		options: { headers?: Record<string, string> } = {}
	): Promise<Response> {
		return this.request(path, {
			method: 'DELETE',
			headers: options.headers
		});
	}

	/**
	 * PATCH with JSON body.
	 */
	async patch(
		path: string,
		body: Record<string, unknown>,
		options: { headers?: Record<string, string> } = {}
	): Promise<Response> {
		return this.request(path, {
			method: 'PATCH',
			headers: {
				'Content-Type': 'application/json',
				...options.headers
			},
			body: JSON.stringify(body)
		});
	}

	/**
	 * Core request method.
	 */
	private async request(
		path: string,
		options: {
			method: string;
			headers?: Record<string, string>;
			body?: string | FormData;
			followRedirects?: boolean;
		}
	): Promise<Response> {
		const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

		const headers: Record<string, string> = { ...options.headers };

		// Attach cookies
		const cookieHeader = this.buildCookieHeader();
		if (cookieHeader) {
			headers['Cookie'] = cookieHeader;
		}

		const shortUrl = url.replace(this.baseUrl, '');

		const res = await fetch(url, {
			method: options.method,
			headers,
			body: options.body,
			redirect: options.followRedirects ? 'follow' : 'manual'
		});

		// Parse Set-Cookie headers
		this.parseSetCookies(res);

		// Build detail string for logging
		const parts: string[] = [];
		if (headers['X-Api-Key']) parts.push('api-key');
		if (cookieHeader) parts.push(`cookies: ${[...this.cookies.keys()].join(', ')}`);
		const location = res.headers.get('location');
		if (location) parts.push(`→ ${location}`);
		const setCookies =
			(res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
		if (setCookies.length) {
			parts.push(`set-cookie: ${setCookies.map((c) => c.split('=')[0]).join(', ')}`);
		}

		// Clone response to read body for logging without consuming the original
		let bodyStr = '';
		try {
			const clone = res.clone();
			bodyStr = await clone.text();
		} catch {
			// Body may not be readable (e.g. redirect with no body)
		}
		// Only log body for short responses (API JSON etc), skip full HTML pages
		if (bodyStr && !bodyStr.includes('<!DOCTYPE') && !bodyStr.includes('<html')) {
			parts.push(bodyStr.length > 200 ? bodyStr.slice(0, 200) + '...' : bodyStr);
		}

		log.request(options.method, shortUrl, res.status, parts.length ? parts.join(' | ') : undefined);

		return res;
	}

	/**
	 * Get a cookie value by name.
	 */
	getCookie(name: string): string | undefined {
		return this.cookies.get(name)?.value;
	}

	/**
	 * Get full cookie attributes (Secure, HttpOnly, SameSite, etc.).
	 */
	getCookieAttributes(name: string): Record<string, string> | undefined {
		return this.cookies.get(name)?.attributes;
	}

	/**
	 * Get the raw Set-Cookie header value for a cookie name from the last response.
	 * Must be called right after the request that sets it.
	 */
	static getSetCookieHeaders(response: Response): string[] {
		const headers: string[] = [];
		response.headers.forEach((value, key) => {
			if (key.toLowerCase() === 'set-cookie') {
				headers.push(value);
			}
		});

		// fetch() may merge Set-Cookie headers — split on comma if needed
		// But Set-Cookie headers with dates have commas too, so use getSetCookie if available
		if (headers.length === 0) {
			// Fallback: try accessing raw headers
			const raw = (
				response.headers as unknown as { getSetCookie?: () => string[] }
			).getSetCookie?.();
			if (raw) return raw;
		}

		return headers;
	}

	/**
	 * Clear all cookies.
	 */
	clearCookies(): void {
		this.cookies.clear();
	}

	/**
	 * Build the Cookie header from the jar.
	 */
	private buildCookieHeader(): string {
		if (this.cookies.size === 0) return '';
		return [...this.cookies.values()].map((c) => `${c.name}=${c.value}`).join('; ');
	}

	/**
	 * Parse Set-Cookie headers from a response and update the jar.
	 */
	private parseSetCookies(response: Response): void {
		// Use getSetCookie() if available (Deno supports this)
		const setCookies =
			(response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];

		for (const header of setCookies) {
			const cookie = parseSetCookieHeader(header);
			if (cookie) {
				this.cookies.set(cookie.name, cookie);
			}
		}
	}
}

/**
 * Parse a single Set-Cookie header string into a Cookie object.
 */
function parseSetCookieHeader(header: string): Cookie | null {
	const parts = header.split(';').map((p) => p.trim());
	if (parts.length === 0) return null;

	const [nameValue, ...attrParts] = parts;
	const eqIndex = nameValue.indexOf('=');
	if (eqIndex === -1) return null;

	const name = nameValue.slice(0, eqIndex).trim();
	const value = nameValue.slice(eqIndex + 1).trim();

	const attributes: Record<string, string> = {};
	for (const part of attrParts) {
		const attrEq = part.indexOf('=');
		if (attrEq === -1) {
			// Flag attribute (e.g., HttpOnly, Secure)
			attributes[part.toLowerCase()] = 'true';
		} else {
			const key = part.slice(0, attrEq).trim().toLowerCase();
			const val = part.slice(attrEq + 1).trim();
			attributes[key] = val;
		}
	}

	return { name, value, attributes };
}
