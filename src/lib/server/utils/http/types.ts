/**
 * HTTP Client Types
 */

export interface HttpClientOptions {
	timeout?: number; // Request timeout in milliseconds (default: 30000)
	headers?: Record<string, string>; // Default headers to include in all requests
	retries?: number; // Number of retries (default: 3)
	retryDelay?: number; // Initial retry delay in ms (default: 500)
	retryStatusCodes?: number[]; // Status codes to retry on (default: [500, 502, 503, 504])
}

export interface RequestOptions {
	headers?: Record<string, string>; // Additional headers for this request
	timeout?: number; // Override timeout for this request
	signal?: AbortSignal; // Abort signal for cancellation
	responseType?: 'json' | 'text'; // Response parsing type (default: 'json')
}

export class HttpError extends Error {
	constructor(
		message: string,
		public status: number,
		public response?: unknown
	) {
		super(message);
		this.name = 'HttpError';
	}
}
