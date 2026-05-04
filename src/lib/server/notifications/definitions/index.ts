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
import { arrCleanup } from './arrCleanup.ts';
import { arrDriftDetected, arrDriftFailed } from './arrDrift.ts';
import { pcdUpdatesAvailable, pcdSyncSuccess, pcdSyncFailed, pcdLinkFailed } from './pcdSync.ts';
import { backupSuccess, backupFailed } from './backup.ts';
import { announcementNew } from './announcement.ts';

export const notifications = {
	test,
	rename,
	upgrade,
	arrSync,
	arrCleanup,
	arrDriftDetected,
	arrDriftFailed,
	pcdUpdatesAvailable,
	pcdSyncSuccess,
	pcdSyncFailed,
	pcdLinkFailed,
	backupSuccess,
	backupFailed,
	announcementNew
};
