import type { Notification } from '#notifications/types.ts';

/**
 * Base interface that all notification service implementations must follow
 */
export interface Notifier {
	/**
	 * Send a notification
	 * This method should be fire-and-forget - errors should be logged but not thrown
	 */
	notify(notification: Notification): Promise<void>;

	/**
	 * Get the service name for logging purposes
	 */
	getName(): string;
}
