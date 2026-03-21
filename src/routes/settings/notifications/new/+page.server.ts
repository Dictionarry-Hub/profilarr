import type { Actions, RequestEvent } from '@sveltejs/kit';
import { fail, redirect } from '@sveltejs/kit';
import { logger } from '$logger/logger.ts';
import { notificationServicesQueries } from '$db/queries/notificationServices.ts';
import { getAllNotificationTypeIds } from '$shared/notifications/types.ts';

export const actions: Actions = {
	create: async ({ request }: RequestEvent) => {
		const formData = await request.formData();
		const serviceType = formData.get('type') as string;
		const name = formData.get('name') as string;

		if (!serviceType || !name) {
			return fail(400, { error: 'Service type and name are required' });
		}

		// Validate name uniqueness
		if (notificationServicesQueries.existsByName(name)) {
			return fail(400, { error: 'A service with this name already exists' });
		}

		// Build config based on service type
		let config: Record<string, unknown> = {};
		let enabledTypes: string[] = [];

		if (serviceType === 'discord') {
			const webhookUrl = formData.get('webhook_url') as string;
			const username = formData.get('username') as string;
			const avatarUrl = formData.get('avatar_url') as string;
			const enableMentions = formData.get('enable_mentions') === 'on';

			if (!webhookUrl) {
				return fail(400, { error: 'Webhook URL is required for Discord' });
			}

			config = {
				webhook_url: webhookUrl,
				...(username && { username }),
				...(avatarUrl && { avatar_url: avatarUrl }),
				enable_mentions: enableMentions
			};
		} else if (serviceType === 'ntfy') {
			const serverUrl = formData.get('server_url') as string;
			const topic = formData.get('topic') as string;
			const accessToken = formData.get('access_token') as string;

			if (!serverUrl || !topic) {
				return fail(400, { error: 'Server URL and topic are required for Ntfy' });
			}

			config = {
				server_url: serverUrl,
				topic,
				...(accessToken && { access_token: accessToken })
			};
		} else if (serviceType === 'webhook') {
			const webhookUrl = formData.get('webhook_url') as string;
			const authHeader = formData.get('auth_header') as string;

			if (!webhookUrl) {
				return fail(400, { error: 'Webhook URL is required' });
			}

			config = {
				webhook_url: webhookUrl,
				...(authHeader && { auth_header: authHeader })
			};
		} else if (serviceType === 'telegram') {
			const botToken = formData.get('bot_token') as string;
			const chatId = formData.get('chat_id') as string;

			if (!botToken || !chatId) {
				return fail(400, { error: 'Bot token and chat ID are required for Telegram' });
			}

			config = {
				bot_token: botToken,
				chat_id: chatId
			};
		}

		// Get enabled notification types dynamically from all available types
		const allTypeIds = getAllNotificationTypeIds();
		enabledTypes = allTypeIds.filter((typeId) => formData.get(typeId) === 'on');

		// Generate UUID for the service
		const id = crypto.randomUUID();

		// Create the service
		const success = notificationServicesQueries.create({
			id,
			name,
			serviceType,
			enabled: true,
			config,
			enabledTypes
		});

		if (!success) {
			return fail(500, { error: 'Failed to create notification service' });
		}

		await logger.info('Notification service created', {
			source: 'settings/notifications/new',
			meta: { serviceId: id, serviceType, name }
		});

		throw redirect(303, '/settings/notifications');
	}
};
