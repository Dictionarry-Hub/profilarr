import type { Actions, RequestEvent } from '@sveltejs/kit';
import { fail } from '@sveltejs/kit';
import { logger } from '$logger/logger.ts';
import { notificationServicesQueries } from '$db/queries/notificationServices.ts';
import { notificationHistoryQueries } from '$db/queries/notificationHistory.ts';
import type { NotificationService } from '$db/queries/notificationServices.ts';

interface NotificationServiceWithStats extends NotificationService {
	successCount: number;
	failedCount: number;
	successRate: number;
}

export const load = () => {
	const services = notificationServicesQueries.getAll();

	// Get stats for each service
	const servicesWithStats: NotificationServiceWithStats[] = services.map((service) => {
		const stats = notificationHistoryQueries.getStats(service.id);
		// Strip webhook_url from config JSON before sending to frontend
		let safeConfig = service.config;
		try {
			const parsed = JSON.parse(service.config);
			const { webhook_url: _, ...rest } = parsed;
			safeConfig = JSON.stringify(rest);
		} catch {
			// If config isn't valid JSON, send as-is (no secret to strip)
		}
		return {
			...service,
			config: safeConfig,
			successCount: stats.success,
			failedCount: stats.failed,
			successRate: stats.successRate
		};
	});

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
			const { notificationManager } = await import('$notifications/NotificationManager.ts');
			const { test } = await import('$notifications/definitions/test.ts');

			await notificationManager.sendToService(id, test());

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
