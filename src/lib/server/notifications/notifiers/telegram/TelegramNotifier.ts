import type { TelegramConfig, Notification, NotificationSeverity } from '../../types.ts';
import { getWebhookClient } from '../../base/webhookClient.ts';

const TELEGRAM_API = 'https://api.telegram.org';
const MAX_MESSAGE_LENGTH = 4096;

/**
 * Telegram notification service implementation.
 * Summary tier: renders title, message, and field blocks only.
 * Section blocks are omitted — Telegram is for quick pings, not full detail.
 */
export class TelegramNotifier {
	constructor(private config: TelegramConfig) {}

	getName(): string {
		return 'Telegram';
	}

	async notify(notification: Notification): Promise<void> {
		const base = this.config.api_base_url ?? TELEGRAM_API;
		const url = `${base}/bot${this.config.bot_token}/sendMessage`;
		const payload = this.formatPayload(notification);

		await getWebhookClient().post(url, payload);
	}

	private formatPayload(notification: Notification): unknown {
		const emoji = this.getEmoji(notification.severity);
		const blocks = notification.blocks ?? [];
		const parts: string[] = [];

		parts.push(`${emoji} <b>${notification.title}</b>`);
		parts.push(notification.message);

		for (const block of blocks) {
			if (block.kind === 'field') {
				parts.push(`<b>${block.label}:</b> ${block.value}`);
			}
			// Section blocks omitted (summary tier)
		}

		let text = parts.join('\n\n');
		if (text.length > MAX_MESSAGE_LENGTH) {
			text = text.slice(0, MAX_MESSAGE_LENGTH - 1) + '\u2026';
		}

		return {
			chat_id: this.config.chat_id,
			text,
			parse_mode: 'HTML'
		};
	}

	private getEmoji(severity: NotificationSeverity): string {
		switch (severity) {
			case 'success':
				return '\u2705';
			case 'error':
				return '\u274C';
			case 'warning':
				return '\u26A0\uFE0F';
			case 'info':
				return '\u2139\uFE0F';
			default:
				return '\u2139\uFE0F';
		}
	}
}
