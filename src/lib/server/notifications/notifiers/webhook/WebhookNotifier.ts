import type { WebhookConfig, Notification } from '../../types.ts';
import { getWebhookClient } from '../../base/webhookClient.ts';

/**
 * Webhook notification service implementation.
 * Passthrough tier: sends the raw Notification object as JSON with no rendering.
 */
export class WebhookNotifier {
	constructor(private config: WebhookConfig) {}

	getName(): string {
		return 'Webhook';
	}

	async notify(notification: Notification): Promise<void> {
		const headers: Record<string, string> = {};
		if (this.config.auth_header) {
			headers['Authorization'] = this.config.auth_header;
		}

		await getWebhookClient().post(this.config.webhook_url, notification, {
			headers,
			responseType: 'text'
		});
	}
}
