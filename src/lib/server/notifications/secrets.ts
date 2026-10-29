import type { NotificationServiceConfig } from '#db/queries/notificationServices.ts';

/**
 * Config keys that hold credentials. They never leave the server: the
 * notifications list page gets no config at all, and the edit page gets the
 * config with these keys removed. Add the key here when a new service type
 * introduces a secret.
 */
export const NOTIFICATION_SECRET_KEYS: ReadonlySet<string> = new Set([
	'webhook_url',
	'access_token',
	'auth_header',
	'bot_token'
]);

/** Names of the secret keys that hold a value, so a form can require them without seeing them. */
export function storedNotificationSecrets(config: NotificationServiceConfig): string[] {
	return Object.keys(config).filter((key) => NOTIFICATION_SECRET_KEYS.has(key) && !!config[key]);
}

/** Copy of `config` without any secret key. */
export function stripNotificationSecrets(
	config: NotificationServiceConfig
): NotificationServiceConfig {
	return Object.fromEntries(
		Object.entries(config).filter(([key]) => !NOTIFICATION_SECRET_KEYS.has(key))
	);
}
