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

export const notifications = {
	test,
	rename,
	upgrade
};
