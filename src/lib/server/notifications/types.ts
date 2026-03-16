/**
 * Core notification types and interfaces
 */

/**
 * Type-safe notification type constants
 */
export const NotificationTypes = {
	// Jobs (dynamic - constructed with job name)
	jobSuccess: (jobName: string) => `job.${jobName}.success` as const,
	jobFailed: (jobName: string) => `job.${jobName}.failed` as const,

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
	RENAME_FAILED: 'rename.failed'
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
 * A larger content block (renamed files, upgrade details, error lists)
 */
export interface SectionBlock {
	kind: 'section';
	title: string;
	content: string;
	imageUrl?: string;
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
 * Union type for all notification service configs
 */
export type NotificationServiceConfig = DiscordConfig;

/**
 * Service types supported
 */
export type NotificationServiceType = 'discord';
