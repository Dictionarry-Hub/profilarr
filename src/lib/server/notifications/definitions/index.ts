/**
 * Notification definitions
 *
 * Each definition takes domain data and returns a structured Notification.
 * Definitions are service-agnostic. Notifiers handle rendering.
 *
 * @example
 * import { notifications } from '$notifications/definitions/index.ts';
 * await notificationManager.notify(notifications.rename({ log, summaryNotifications }));
 */

import { test } from './test.ts';
import { rename } from './rename.ts';
import { upgrade } from './upgrade.ts';
import { arrSync } from './arrSync.ts';
import { pcdUpdatesAvailable, pcdSyncSuccess, pcdSyncFailed } from './pcdSync.ts';
import { backupSuccess, backupFailed } from './backup.ts';

export const notifications = {
	test,
	rename,
	upgrade,
	arrSync,
	pcdUpdatesAvailable,
	pcdSyncSuccess,
	pcdSyncFailed,
	backupSuccess,
	backupFailed
};
