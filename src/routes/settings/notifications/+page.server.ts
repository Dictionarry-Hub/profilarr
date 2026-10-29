import type { Actions, RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { logger } from '#logger/logger.ts';
import { notificationServicesQueries } from '#db/queries/notificationServices.ts';
import { notificationHistoryQueries } from '#db/queries/notificationHistory.ts';
import type { NotificationService } from '#db/queries/notificationServices.ts';

interface NotificationServiceWithStats extends Omit<NotificationService, 'config'> {
	successCount: number;
	failedCount: number;
	successRate: number;
}

export const load = () => {
	const services = notificationServicesQueries.getAll();

	// The list never shows config, and config holds secrets, so it stays on the server
	const servicesWithStats: NotificationServiceWithStats[] = services.map(
		({ config: _config, ...service }) => {
			const stats = notificationHistoryQueries.getStats(service.id);
			return {
				...service,
				successCount: stats.success,
				failedCount: stats.failed,
				successRate: stats.successRate
			};
		}
	);

	// Get recent notification history (last 50)
	const history = notificationHistoryQueries.getRecent(50);

	return {
		services: servicesWithStats,
		history
	};
};

export const actions: Actions = {
	toggleEnabled: async ({ request }: RequestEvent) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;
		const enabled = formData.get('enabled') === 'true';

		if (!id) {
			return fail(400, { error: 'Service ID is required' });
		}

		try {
			const success = notificationServicesQueries.update(id, { enabled });

			if (!success) {
				return fail(400, { error: 'Failed to update service' });
			}

			await logger.info(`Notification service ${enabled ? 'enabled' : 'disabled'}`, {
				source: 'settings/notifications',
				meta: { serviceId: id, enabled }
			});

			return { success: true };
		} catch (err) {
			await logger.error('Failed to toggle notification service', {
				source: 'settings/notifications',
				meta: { serviceId: id, error: err }
			});
			return fail(500, { error: 'Failed to update service' });
		}
	},

	delete: async ({ request }: RequestEvent) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Service ID is required' });
		}

		try {
			const success = notificationServicesQueries.delete(id);

			if (!success) {
				return fail(400, { error: 'Failed to delete service' });
			}

			await logger.info('Notification service deleted', {
				source: 'settings/notifications',
				meta: { serviceId: id }
			});

			return { success: true };
		} catch (err) {
			await logger.error('Failed to delete notification service', {
				source: 'settings/notifications',
				meta: { serviceId: id, error: err }
			});
			return fail(500, { error: 'Failed to delete service' });
		}
	},

	testNotification: async ({ request }: RequestEvent) => {
		const formData = await request.formData();
		const id = formData.get('id') as string;

		if (!id) {
			return fail(400, { error: 'Service ID is required' });
		}

		try {
			const { notificationManager } = await import('#notifications/NotificationManager.ts');
			const { test } = await import('#notifications/definitions/test.ts');

			const result = await notificationManager.sendToService(id, test());
			if (!result.success) {
				return fail(502, {
					error: `Test notification failed: ${result.error ?? 'Unknown error'}`
				});
			}

			return { success: true };
		} catch (err) {
			await logger.error('Failed to send test notification', {
				source: 'settings/notifications',
				meta: { serviceId: id, error: err }
			});
			return fail(500, { error: 'Failed to send test notification' });
		}
	}
};
