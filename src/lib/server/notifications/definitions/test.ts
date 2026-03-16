/**
 * Test notification definition
 */

import type { Notification } from '../types.ts';

/**
 * Test notification for verifying service configuration
 */
export function test(): Notification {
	return {
		type: 'test',
		severity: 'info',
		title: 'Test Notification',
		message:
			'This is a test notification from Profilarr. If you received this, your notification service is working correctly!'
	};
}
