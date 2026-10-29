/**
 * Shared HTTP client for webhook-based notifications
 * Uses BaseHttpClient for connection pooling
 */

import { BaseHttpClient } from '#utils/http/client.ts';

/**
 * Webhook HTTP client
 * Extends BaseHttpClient with webhook-specific settings:
 * - No retries (webhooks should either work or not)
 * - 10 second timeout
 */
class WebhookClient extends BaseHttpClient {
	constructor() {
		// Empty base URL - we pass full webhook URLs as paths
		super('', {
			timeout: 10000,
			retries: 0
		});
	}

	/**
	 * POST to a webhook URL
	 */
	sendWebhook<T = void>(url: string, payload: unknown): Promise<T> {
		return this.post<T>(url, payload);
	}
}

// Singleton instance - lazy initialized
let webhookClient: WebhookClient | null = null;

/**
 * Get the shared webhook client
 */
export function getWebhookClient(): WebhookClient {
	if (!webhookClient) {
		webhookClient = new WebhookClient();
	}
	return webhookClient;
}
