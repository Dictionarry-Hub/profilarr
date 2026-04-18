/**
 * Shared notification types for both backend and frontend
 * Defines all available notification types and their metadata
 */

export interface NotificationType {
	id: string;
	label: string;
	category: string;
	description?: string;
}

/**
 * All available notification types
 */
export const notificationTypes: NotificationType[] = [
	// Backups
	{
		id: 'backup.success',
		label: 'Backup Completed (Success)',
		category: 'Backups',
		description: 'Notification when a backup is created successfully'
	},
	{
		id: 'backup.failed',
		label: 'Backup Failed',
		category: 'Backups',
		description: 'Notification when backup creation fails'
	},

	// Database Sync
	{
		id: 'pcd.linked',
		label: 'Database Linked',
		category: 'Databases',
		description: 'Notification when a new database is linked'
	},
	{
		id: 'pcd.unlinked',
		label: 'Database Unlinked',
		category: 'Databases',
		description: 'Notification when a database is removed'
	},
	{
		id: 'pcd.updates_available',
		label: 'Database Updates Available',
		category: 'Databases',
		description: 'Notification when database updates are available but auto-pull is disabled'
	},
	{
		id: 'pcd.sync_success',
		label: 'Database Synced (Success)',
		category: 'Databases',
		description: 'Notification when a database is synced successfully'
	},
	{
		id: 'pcd.sync_failed',
		label: 'Database Sync (Failed)',
		category: 'Databases',
		description: 'Notification when database sync fails'
	},

	// Arr Sync
	{
		id: 'arr.sync.success',
		label: 'Arr Sync Completed (Success)',
		category: 'Arr Sync',
		description: 'Notification when all sections sync successfully to an Arr instance'
	},
	{
		id: 'arr.sync.partial',
		label: 'Arr Sync Completed (Partial)',
		category: 'Arr Sync',
		description: 'Notification when some sections fail to sync to an Arr instance'
	},
	{
		id: 'arr.sync.failed',
		label: 'Arr Sync Failed',
		category: 'Arr Sync',
		description: 'Notification when all sections fail to sync to an Arr instance'
	},

	// Arr Cleanup
	{
		id: 'arr.cleanup.success',
		label: 'Arr Cleanup Completed (Success)',
		category: 'Arr Cleanup',
		description:
			'Notification when stale configs and removed entities are all cleaned up successfully'
	},
	{
		id: 'arr.cleanup.partial',
		label: 'Arr Cleanup Completed (Partial)',
		category: 'Arr Cleanup',
		description:
			'Notification when some items could not be deleted (skipped quality profiles or failed entity deletions)'
	},
	{
		id: 'arr.cleanup.failed',
		label: 'Arr Cleanup Failed',
		category: 'Arr Cleanup',
		description: 'Notification when cleanup cannot complete or no items could be deleted'
	},

	// Upgrades
	{
		id: 'upgrade.success',
		label: 'Upgrade Completed (Success)',
		category: 'Upgrades',
		description: 'Notification when all upgrade searches complete successfully'
	},
	{
		id: 'upgrade.partial',
		label: 'Upgrade Completed (Partial)',
		category: 'Upgrades',
		description: 'Notification when some upgrade searches succeed and some fail'
	},
	{
		id: 'upgrade.failed',
		label: 'Upgrade Failed',
		category: 'Upgrades',
		description: 'Notification when all upgrade searches fail'
	},

	// Renames
	{
		id: 'rename.success',
		label: 'Rename Completed (Success)',
		category: 'Renames',
		description: 'Notification when all file renames complete successfully'
	},
	{
		id: 'rename.partial',
		label: 'Rename Completed (Partial)',
		category: 'Renames',
		description: 'Notification when some file renames succeed and some fail'
	},
	{
		id: 'rename.failed',
		label: 'Rename Failed',
		category: 'Renames',
		description: 'Notification when all file renames fail'
	}
];

/**
 * Group notification types by category
 */
export function groupNotificationTypesByCategory(): Record<string, NotificationType[]> {
	return notificationTypes.reduce(
		(acc, type) => {
			if (!acc[type.category]) {
				acc[type.category] = [];
			}
			acc[type.category].push(type);
			return acc;
		},
		{} as Record<string, NotificationType[]>
	);
}

/**
 * Get all notification type IDs
 */
export function getAllNotificationTypeIds(): string[] {
	return notificationTypes.map((type) => type.id);
}

/**
 * Validate if a notification type ID exists
 */
export function isValidNotificationType(typeId: string): boolean {
	return notificationTypes.some((type) => type.id === typeId);
}
