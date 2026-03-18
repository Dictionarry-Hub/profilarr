import type { NtfyConfig, Notification, NotificationSeverity } from '../../types.ts';
import { getWebhookClient } from '../../base/webhookClient.ts';

/**
 * Ntfy notification service implementation.
 * Summary tier: renders title, message, and field blocks only.
 * Section blocks are omitted — ntfy is for quick pings, not full detail.
 */
export class NtfyNotifier {
	constructor(private config: NtfyConfig) {}

	getName(): string {
		return 'Ntfy';
	}

	async notify(notification: Notification): Promise<void> {
		const url = this.config.server_url;
		const payload = this.formatPayload(notification);

		const headers: Record<string, string> = {};
		if (this.config.access_token) {
			headers['Authorization'] = `Bearer ${this.config.access_token}`;
		}

		await getWebhookClient().post(url, payload, { headers });
	}

	private formatPayload(notification: Notification): unknown {
		const blocks = notification.blocks ?? [];
		const bodyParts: string[] = [notification.message];

		for (const block of blocks) {
			if (block.kind === 'field') {
				bodyParts.push(`${block.label}: ${block.value}`);
			}
			// Section blocks omitted (summary tier)
		}

		return {
			topic: this.config.topic,
			title: notification.title,
			message: bodyParts.join('\n\n'),
			priority: this.getPriority(notification.severity),
			tags: [this.getTag(notification.severity)]
		};
	}

	private getPriority(severity: NotificationSeverity): number {
		switch (severity) {
			case 'success':
			case 'info':
				return 3;
			case 'warning':
				return 4;
			case 'error':
				return 5;
			default:
				return 3;
		}
	}

	private getTag(severity: NotificationSeverity): string {
		switch (severity) {
			case 'success':
				return 'white_check_mark';
			case 'info':
				return 'information_source';
			case 'warning':
				return 'warning';
			case 'error':
				return 'x';
			default:
				return 'information_source';
		}
	}
}
