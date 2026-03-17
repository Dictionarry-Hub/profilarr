import { logger } from '$logger/logger.ts';
import { notificationServicesQueries } from '$db/queries/notificationServices.ts';
import { notificationHistoryQueries } from '$db/queries/notificationHistory.ts';
import type { Notifier } from './base/Notifier.ts';
import type { Notification, DiscordConfig } from './types.ts';
import { DiscordNotifier } from './notifiers/discord/DiscordNotifier.ts';

/**
 * Central notification manager
 * Orchestrates sending notifications to all enabled services
 */
export class NotificationManager {
	/**
	 * Send a notification to all enabled services that have this notification type enabled.
	 * Fire-and-forget: does not throw errors, failures are logged.
	 */
	async notify(notification: Notification): Promise<void> {
		try {
			const services = notificationServicesQueries.getAllEnabled();

			if (services.length === 0) {
				return;
			}

			const relevantServices = services.filter((service) => {
				try {
					const enabledTypes = JSON.parse(service.enabled_types) as string[];
					return enabledTypes.includes(notification.type);
				} catch {
					return false;
				}
			});

			if (relevantServices.length === 0) {
				return;
			}

			await Promise.allSettled(
				relevantServices.map((service) =>
					this.sendToServiceInternal(service.id, service.service_type, service.config, notification)
				)
			);
		} catch (error) {
			await logger.error('Error in notification manager', {
				source: 'NotificationManager',
				meta: {
					error: error instanceof Error ? error.message : String(error),
					type: notification.type
				}
			});
		}
	}

	/**
	 * Send a notification to a specific service, bypassing the enabled_types filter.
	 * Used for test notifications from the UI.
	 */
	async sendToService(serviceId: string, notification: Notification): Promise<void> {
		try {
			const service = notificationServicesQueries.getById(serviceId);

			if (!service) {
				await logger.error('Service not found for direct send', {
					source: 'NotificationManager',
					meta: { serviceId }
				});
				return;
			}

			await this.sendToServiceInternal(
				service.id,
				service.service_type,
				service.config,
				notification
			);
		} catch (error) {
			await logger.error('Error in direct send', {
				source: 'NotificationManager',
				meta: {
					serviceId,
					error: error instanceof Error ? error.message : String(error),
					type: notification.type
				}
			});
		}
	}

	/**
	 * Internal: send notification to a specific service and record history
	 */
	private async sendToServiceInternal(
		serviceId: string,
		serviceType: string,
		configJson: string,
		notification: Notification
	): Promise<void> {
		let success = false;
		let errorMessage: string | undefined;

		try {
			const notifier = this.createNotifier(serviceType, configJson);

			if (!notifier) {
				errorMessage = `Unknown service type: ${serviceType}`;
				await logger.error(errorMessage, {
					source: 'NotificationManager',
					meta: { serviceId, serviceType }
				});
				return;
			}

			await notifier.notify(notification);
			success = true;
		} catch (error) {
			errorMessage = error instanceof Error ? error.message : String(error);
			await logger.error('Failed to send notification to service', {
				source: 'NotificationManager',
				meta: {
					serviceId,
					serviceType,
					error: errorMessage
				}
			});
		} finally {
			try {
				notificationHistoryQueries.create({
					serviceId,
					notificationType: notification.type,
					title: notification.title,
					message: notification.message,
					status: success ? 'success' : 'failed',
					error: errorMessage
				});
			} catch (error) {
				await logger.error('Failed to record notification history', {
					source: 'NotificationManager',
					meta: {
						serviceId,
						error: error instanceof Error ? error.message : String(error)
					}
				});
			}
		}
	}

	/**
	 * Create a notifier instance based on service type and config
	 */
	private createNotifier(serviceType: string, configJson: string): Notifier | null {
		try {
			const config = JSON.parse(configJson);

			switch (serviceType) {
				case 'discord':
					return new DiscordNotifier(config as DiscordConfig);
				default:
					return null;
			}
		} catch (error) {
			logger.error('Failed to parse notification service config', {
				source: 'NotificationManager',
				meta: {
					serviceType,
					error: error instanceof Error ? error.message : String(error)
				}
			});
			return null;
		}
	}
}

/**
 * Singleton instance
 */
export const notificationManager = new NotificationManager();
