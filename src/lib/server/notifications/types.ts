/**
 * Core notification types and interfaces
 */

/**
 * Type-safe notification type constants
 */
export const NotificationTypes = {
	// PCD / Databases
	PCD_LINKED: 'pcd.linked',
	PCD_UNLINKED: 'pcd.unlinked',
	PCD_UPDATES_AVAILABLE: 'pcd.updates_available',
	PCD_SYNC_SUCCESS: 'pcd.sync_success',
	PCD_SYNC_FAILED: 'pcd.sync_failed',

	// Upgrades
	UPGRADE_SUCCESS: 'upgrade.success',
	UPGRADE_PARTIAL: 'upgrade.partial',
	UPGRADE_FAILED: 'upgrade.failed',

	// Renames
	RENAME_SUCCESS: 'rename.success',
	RENAME_PARTIAL: 'rename.partial',
	RENAME_FAILED: 'rename.failed',

	// Arr Sync
	ARR_SYNC_SUCCESS: 'arr.sync.success',
	ARR_SYNC_PARTIAL: 'arr.sync.partial',
	ARR_SYNC_FAILED: 'arr.sync.failed',

	// Backups
	BACKUP_SUCCESS: 'backup.success',
	BACKUP_FAILED: 'backup.failed'
} as const;

/**
 * Notification severity levels
 */
export type NotificationSeverity = 'success' | 'error' | 'warning' | 'info';

/**
 * A key-value metadata block (stats, counts, modes)
 */
export interface FieldBlock {
	kind: 'field';
	label: string;
	value: string;
	inline?: boolean;
}

/**
 * A labeled group of items within a section (e.g. "created": ["HD Bluray", "UHD Bluray"])
 */
export interface SectionItem {
	label: string;
	items: string[];
}

/**
 * A larger content block (renamed files, upgrade details, error lists)
 */
export interface SectionBlock {
	kind: 'section';
	title: string;
	content: string;
	imageUrl?: string;
	items?: SectionItem[];
}

/**
 * Discriminated union of block types
 */
export type NotificationBlock = FieldBlock | SectionBlock;

/**
 * Notification payload sent to services.
 * Service-agnostic structured document. Notifiers render this
 * into their platform-specific format.
 */
export interface Notification {
	type: string;
	severity: NotificationSeverity;
	title: string;
	message: string;
	/**
	 * Optional hint for how the message should be rendered.
	 * Detail-tier notifiers (Discord) honor this; Summary-tier notifiers
	 * (Ntfy, Telegram) and Passthrough (Webhook) ignore it and render plain text.
	 */
	messageFormat?: 'plain' | 'code';
	blocks?: NotificationBlock[];
}

/**
 * Result of a notification attempt
 */
export interface NotificationResult {
	success: boolean;
	error?: string;
}

/**
 * Configuration for Discord notifications
 */
export interface DiscordConfig {
	webhook_url: string;
	username?: string;
	avatar_url?: string;
	enable_mentions?: boolean;
}
/**
 * Configuration for Ntfy notifications
 */
export interface NtfyConfig {
	server_url: string;
	topic: string;
	access_token?: string;
}

/**
 * Configuration for Webhook notifications
 */
export interface WebhookConfig {
	webhook_url: string;
	auth_header?: string;
}

/**
 * Configuration for Telegram notifications
 */
export interface TelegramConfig {
	bot_token: string;
	chat_id: string;
	api_base_url?: string;
}

/**
 * Union type for all notification service configs
 */
export type NotificationServiceConfig = DiscordConfig | NtfyConfig | WebhookConfig | TelegramConfig;

/**
 * Service types supported
 */
export type NotificationServiceType = 'discord' | 'ntfy' | 'webhook' | 'telegram';
