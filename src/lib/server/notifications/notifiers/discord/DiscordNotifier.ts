import type { DiscordConfig, Notification, NotificationSeverity } from '../../types.ts';
import { Colors, type DiscordEmbed } from './embed.ts';
import { getWebhookClient } from '../../base/webhookClient.ts';

const RATE_LIMIT_DELAY = 1000;

// Discord limits
const MAX_EMBED_SIZE = 5800; // Safety margin under 6000
const MAX_FIELDS_PER_EMBED = 25;
const MAX_FIELD_VALUE = 1024;
const MAX_FIELD_NAME = 256;

/**
 * Calculate Discord's character count for an embed
 */
function getEmbedCharCount(embed: DiscordEmbed): number {
	let size = 0;
	if (embed.author?.name) size += embed.author.name.length;
	if (embed.title) size += embed.title.length;
	if (embed.description) size += embed.description.length;
	if (embed.footer?.text) size += embed.footer.text.length;
	if (embed.fields) {
		for (const field of embed.fields) {
			size += field.name.length + field.value.length;
		}
	}
	return size;
}

/**
 * Discord notification service implementation.
 * Renders structured Notification payloads into Discord embeds.
 */
export class DiscordNotifier {
	constructor(private config: DiscordConfig) {}

	getName(): string {
		return 'Discord';
	}

	/**
	 * Render notification into embeds and send, splitting into multiple messages if needed
	 */
	async notify(notification: Notification): Promise<void> {
		const allEmbeds = this.renderEmbeds(notification);
		const chunks = allEmbeds.map((embed) => [embed]);

		for (let i = 0; i < chunks.length; i++) {
			if (i > 0) {
				await this.sleep(RATE_LIMIT_DELAY);
			}

			const payload = {
				username: this.config.username || 'Profilarr',
				avatar_url: this.config.avatar_url,
				content: i === 0 && this.config.enable_mentions ? '@here' : undefined,
				embeds: chunks[i]
			};

			await this.sendWebhook(payload);
		}
	}

	/**
	 * Render a Notification into one or more Discord embeds
	 */
	private renderEmbeds(notification: Notification): DiscordEmbed[] {
		const color = this.getColorForSeverity(notification.severity);
		const blocks = notification.blocks ?? [];

		// No blocks: single embed with just title + message
		if (blocks.length === 0) {
			return [this.buildChrome(notification, color)];
		}

		const embeds: DiscordEmbed[] = [];
		let currentEmbed = this.buildChrome(notification, color);
		let currentSize = getEmbedCharCount(currentEmbed);
		let currentFieldCount = currentEmbed.fields?.length ?? 0;

		for (const block of blocks) {
			if (block.kind === 'section' && block.imageUrl) {
				// Image section: finalize current embed, create dedicated embed with thumbnail
				if (currentFieldCount > 0 || currentEmbed.title) {
					embeds.push(currentEmbed);
				}

				const itemEmbed: DiscordEmbed = {
					title: this.truncate(block.title, 256),
					color,
					thumbnail: { url: block.imageUrl },
					timestamp: new Date().toISOString(),
					author: {
						name: this.config.username || 'Profilarr',
						icon_url: this.config.avatar_url
					},
					footer: { text: `Type: ${notification.type}` },
					fields: []
				};

				// Split content into separate code block fields by double newline
				const contentSections = block.content.split('\n\n');
				for (const section of contentSections) {
					const lines = section.split('\n');
					const heading = lines[0] ?? '';
					const body = lines.slice(1).join('\n');
					if (body) {
						itemEmbed.fields!.push({
							name: this.truncate(heading, MAX_FIELD_NAME),
							value: '```\n' + this.truncate(body, MAX_FIELD_VALUE - 8) + '\n```',
							inline: false
						});
					} else {
						itemEmbed.fields!.push({
							name: this.truncate(heading, MAX_FIELD_NAME),
							value: '\u200b',
							inline: false
						});
					}
				}

				embeds.push(itemEmbed);

				// Start fresh for any following blocks
				currentEmbed = this.buildContinuationChrome(notification, color);
				currentSize = getEmbedCharCount(currentEmbed);
				currentFieldCount = 0;
				continue;
			}

			let fieldName: string;
			let fieldValue: string;
			let inline: boolean | undefined;

			if (block.kind === 'field') {
				fieldName = this.truncate(block.label, MAX_FIELD_NAME);
				fieldValue = this.truncate(block.value, MAX_FIELD_VALUE);
				inline = block.inline;
			} else {
				fieldName = this.truncate(block.title, MAX_FIELD_NAME);
				const codeBlockOverhead = 8;
				const maxContent = MAX_FIELD_VALUE - codeBlockOverhead;
				const content =
					block.content.length > maxContent
						? block.content.slice(0, maxContent - 15) + '\n...(truncated)'
						: block.content;
				fieldValue = '```\n' + content + '\n```';
				inline = false;
			}

			const fieldChars = fieldName.length + fieldValue.length;

			if (currentFieldCount >= MAX_FIELDS_PER_EMBED || currentSize + fieldChars > MAX_EMBED_SIZE) {
				embeds.push(currentEmbed);
				currentEmbed = this.buildContinuationChrome(notification, color);
				currentSize = getEmbedCharCount(currentEmbed);
				currentFieldCount = 0;
			}

			if (!currentEmbed.fields) {
				currentEmbed.fields = [];
			}
			currentEmbed.fields.push({ name: fieldName, value: fieldValue, inline });
			currentSize += fieldChars;
			currentFieldCount++;
		}

		// Push final embed if it has content
		if (currentFieldCount > 0) {
			embeds.push(currentEmbed);
		}

		// Assign page numbers if multiple embeds
		if (embeds.length > 1) {
			for (let i = 0; i < embeds.length; i++) {
				embeds[i].footer = {
					text: `Type: ${notification.type} | Page ${i + 1}/${embeds.length}`
				};
			}
		}

		return embeds;
	}

	/**
	 * Build a full embed with title, description, and chrome
	 */
	private buildChrome(notification: Notification, color: number): DiscordEmbed {
		return {
			title: notification.title,
			description: notification.message,
			color,
			timestamp: new Date().toISOString(),
			author: {
				name: this.config.username || 'Profilarr',
				icon_url: this.config.avatar_url
			},
			footer: { text: `Type: ${notification.type}` }
		};
	}

	/**
	 * Build a chrome-only embed for continuation pages (no title/description)
	 */
	private buildContinuationChrome(notification: Notification, color: number): DiscordEmbed {
		return {
			color,
			timestamp: new Date().toISOString(),
			author: {
				name: this.config.username || 'Profilarr',
				icon_url: this.config.avatar_url
			},
			footer: { text: `Type: ${notification.type}` }
		};
	}

	/**
	 * Map severity to embed color
	 */
	private getColorForSeverity(severity: NotificationSeverity): number {
		switch (severity) {
			case 'success':
				return Colors.SUCCESS;
			case 'error':
				return Colors.ERROR;
			case 'warning':
				return Colors.WARNING;
			case 'info':
				return Colors.INFO;
			default:
				return Colors.INFO;
		}
	}

	/**
	 * Truncate a string to fit within a limit
	 */
	private truncate(text: string, limit: number): string {
		if (text.length <= limit) return text;
		return text.slice(0, limit - 3) + '...';
	}

	/**
	 * Send a single webhook request
	 */
	private async sendWebhook(payload: unknown): Promise<void> {
		await getWebhookClient().sendWebhook(this.config.webhook_url, payload);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
