/**
 * Mock HTTP server for capturing webhook requests.
 * Used to verify what notifiers actually send.
 */

import { serve, type MockHttpServer } from '#integration/harness/http.ts';

export interface CapturedRequest {
	method: string;
	path: string;
	headers: Record<string, string>;
	body: unknown;
}

/**
 * Create a mock HTTP server that captures all incoming requests.
 * Resolves once listening, with the captured requests array (mutated in place)
 * and the server handle.
 */
export async function createMockServer(
	port: number,
	responseStatus: number = 200
): Promise<{ captured: CapturedRequest[]; server: MockHttpServer }> {
	const captured: CapturedRequest[] = [];

	const server = await serve(port, async (req) => {
		const url = new URL(req.url);
		let body: unknown = null;
		try {
			body = await req.json();
		} catch {
			// Not JSON
		}

		captured.push({
			method: req.method,
			path: url.pathname,
			headers: Object.fromEntries(req.headers),
			body
		});

		return new Response(JSON.stringify({ ok: responseStatus < 400 }), {
			status: responseStatus,
			headers: { 'Content-Type': 'application/json' }
		});
	});

	return { captured, server };
}
