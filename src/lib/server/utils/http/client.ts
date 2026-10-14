import type { HttpClientOptions, RequestOptions } from './types.ts';
import { HttpError } from './types.ts';

/**
 * Base HTTP client with retries, timeouts and generic request capabilities.
 * Connections are pooled and reused by fetch itself, shared across clients.
 */
export class BaseHttpClient {
	protected baseUrl: string;
	protected defaultHeaders: Record<string, string>;
	protected timeout: number;
	protected retries: number;
	protected retryDelay: number;
	protected retryStatusCodes: number[];

	constructor(baseUrl: string, options?: HttpClientOptions) {
		// Ensure baseUrl doesn't have trailing slash
		this.baseUrl = baseUrl.replace(/\/$/, '');
		this.timeout = options?.timeout ?? 30000;
		this.retries = options?.retries ?? 3;
		this.retryDelay = options?.retryDelay ?? 500;
		this.retryStatusCodes = options?.retryStatusCodes ?? [500, 502, 503, 504];
		this.defaultHeaders = {
			'Content-Type': 'application/json',
			...options?.headers
		};
	}

	/**
	 * Sleep for specified milliseconds
	 */
	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Make an HTTP request with retry logic
	 */
	protected async request<T>(
		method: string,
		path: string,
		options?: RequestOptions & { body?: unknown }
	): Promise<T> {
		let lastError: HttpError | undefined;

		// Retry loop
		for (let attempt = 0; attempt <= this.retries; attempt++) {
			try {
				const url = `${this.baseUrl}${path}`;
				const timeout = options?.timeout ?? this.timeout;

				// Create abort controller for timeout
				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), timeout);

				try {
					const headers = {
						...this.defaultHeaders,
						...options?.headers
					};

					const response = await fetch(url, {
						method,
						headers,
						body: options?.body ? JSON.stringify(options.body) : undefined,
						signal: options?.signal ?? controller.signal
					});

					clearTimeout(timeoutId);

					// Parse response based on responseType
					const text = await response.text();
					const responseType = options?.responseType ?? 'json';
					const data = responseType === 'text' ? text : text ? JSON.parse(text) : null;

					// Check for HTTP errors
					if (!response.ok) {
						const error = new HttpError(
							`HTTP ${response.status}: ${response.statusText}`,
							response.status,
							responseType === 'json' ? data : text
						);

						// Retry on specific status codes
						if (this.retryStatusCodes.includes(response.status) && attempt < this.retries) {
							lastError = error;
							// Exponential backoff: delay * (2 ^ attempt)
							const delay = this.retryDelay * Math.pow(2, attempt);
							await this.sleep(delay);
							continue;
						}

						throw error;
					}

					return data as T;
				} catch (error) {
					clearTimeout(timeoutId);

					// Handle abort/timeout
					if (error instanceof Error && error.name === 'AbortError') {
						throw new HttpError('Request timeout', 408);
					}

					// Re-throw HttpError (might be retryable)
					if (error instanceof HttpError) {
						throw error;
					}

					// Wrap other errors
					throw new HttpError(error instanceof Error ? error.message : 'Unknown error', 0);
				}
			} catch (error) {
				// If it's not an HttpError or not retryable, throw immediately
				if (error instanceof HttpError) {
					if (this.retryStatusCodes.includes(error.status) && attempt < this.retries) {
						lastError = error;
						const delay = this.retryDelay * Math.pow(2, attempt);
						await this.sleep(delay);
						continue;
					}
				}
				throw error;
			}
		}

		// If we exhausted retries, throw the last error
		throw lastError ?? new HttpError('Request failed after retries', 0);
	}

	/**
	 * GET request
	 */
	get<T>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>('GET', path, options);
	}

	/**
	 * POST request
	 */
	post<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.request<T>('POST', path, { ...options, body });
	}

	/**
	 * PUT request
	 */
	put<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.request<T>('PUT', path, { ...options, body });
	}

	/**
	 * DELETE request
	 */
	delete<T>(path: string, options?: RequestOptions): Promise<T> {
		return this.request<T>('DELETE', path, options);
	}

	/**
	 * PATCH request
	 */
	patch<T>(path: string, body?: unknown, options?: RequestOptions): Promise<T> {
		return this.request<T>('PATCH', path, { ...options, body });
	}
}
