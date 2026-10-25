/**
 * Settings › Notifications: create, edit, test and delete Webhook services
 * the way a user does, and typed readers for what the list and edit pages
 * load. Each helper waits for the form action behind its button, so a
 * scenario continues once the app has stored the change or sent the test.
 */

import { expect, test, type Locator, type Page } from '@playwright/test';
import {
	chooseOption,
	confirmDialog,
	saveForm,
	setSwitch,
	waitForAction,
	type ActionResult
} from '$flows/helpers/core/forms.ts';
import { openSidebarPage, waitForHydration } from '$flows/helpers/core/nav.ts';
import { pageData } from '$flows/helpers/core/pageData.ts';

const LIST_PATH = '/settings/notifications';

/** A service as the list page loads it; the list never gets its config */
export interface NotificationServiceRow {
	id: string;
	name: string;
	service_type: string;
	enabled: number;
	/** JSON text of the notification type ids it gets */
	enabled_types: string;
	successCount: number;
	failedCount: number;
	successRate: number;
	[field: string]: unknown;
}

/** One sent notification, as the list page loads it */
export interface NotificationHistoryRow {
	id: number;
	service_id: string;
	notification_type: string;
	title: string;
	message: string;
	status: 'success' | 'failed';
	error: string | null;
	sent_at: string;
}

/** A service as its edit page loads it, with the secret keys removed */
export interface NotificationEditData {
	id: string;
	name: string;
	serviceType: string;
	enabled: boolean;
	config: Record<string, unknown>;
	/** Which secret keys hold a value */
	storedSecrets: string[];
	enabledTypes: string[];
}

interface ListPage {
	services: NotificationServiceRow[];
	history: NotificationHistoryRow[];
}

/** Every service, from the list page */
export async function notificationServices(page: Page): Promise<NotificationServiceRow[]> {
	return await test.step(
		'Read the notification services',
		async () => (await pageData<ListPage>(page, LIST_PATH)).services,
		{ box: true }
	);
}

/** The recent notification history, newest first, from the list page */
export async function notificationHistory(page: Page): Promise<NotificationHistoryRow[]> {
	return await test.step(
		'Read the notification history',
		async () => (await pageData<ListPage>(page, LIST_PATH)).history,
		{ box: true }
	);
}

/** One service, from its edit page */
export async function notificationEdit(page: Page, id: string): Promise<NotificationEditData> {
	return await test.step(
		`Read the edit page of notification service ${id}`,
		async () =>
			(await pageData<{ service: NotificationEditData }>(page, `${LIST_PATH}/edit/${id}`)).service,
		{ box: true }
	);
}

/**
 * The services table's row for a service. The history table names services
 * too, so this takes the row with the service's own buttons.
 */
export function serviceRow(page: Page, name: string): Locator {
	return page
		.getByRole('main')
		.getByRole('row')
		.filter({ has: page.getByText(name, { exact: true }) })
		.filter({ has: page.getByRole('button', { name: 'Send test notification' }) });
}

/** Open the list page unless the page is already on it */
async function onList(page: Page): Promise<void> {
	if (page.url() !== 'about:blank' && new URL(page.url()).pathname === LIST_PATH) {
		await waitForHydration(page);
	} else {
		await openSidebarPage(page, 'Notifications');
	}
}

/** Fill a field by its label; the URL and header fields are password inputs, not textboxes */
async function fillByLabel(scope: Locator, label: string, value: string): Promise<void> {
	const field = scope.getByLabel(new RegExp(`^${label}\\*?$`));
	await expect(field, `The ${label} field should be shown`).toBeVisible();
	await field.fill(value);
	await expect(field, `${label} should hold the typed value`).toHaveValue(value);
}

/** Set each notification type switch, by its label, on when listed and off otherwise */
async function setTypes(scope: Locator, on: string[], off: string[] = []): Promise<void> {
	for (const label of on) await setSwitch(scope, label, true);
	for (const label of off) await setSwitch(scope, label, false);
}

export interface NotificationServiceOptions {
	name: string;
	/** The Webhook URL */
	url: string;
	/** The Authorization Header, left blank by default */
	authHeader?: string;
	/** Labels of the notification types to turn on, e.g. "Backup Completed (Success)" */
	types?: string[];
}

/**
 * Create a Webhook service from Add Service, then wait for the list to show
 * it. Every type not in `types` stays off. Returns the new service's id.
 */
export async function createNotificationService(
	page: Page,
	options: NotificationServiceOptions
): Promise<string> {
	return await test.step(
		`Create the notification service ${options.name}`,
		async () => {
			await onList(page);
			const main = page.getByRole('main');
			await main.getByRole('link', { name: 'Add Service', exact: true }).click();
			await expect(page, 'Add Service should open the new service form').toHaveURL(
				(url) => url.pathname === `${LIST_PATH}/new`
			);
			await waitForHydration(page);

			await chooseOption(main, 'Service Type', 'Webhook');
			await fillByLabel(main, 'Service Name', options.name);
			await fillByLabel(main, 'Webhook URL', options.url);
			if (options.authHeader !== undefined) {
				await fillByLabel(main, 'Authorization Header', options.authHeader);
			}
			await setTypes(main, options.types ?? []);

			await saveForm(page, { button: 'Create Service', action: 'create' });
			await expect(
				serviceRow(page, options.name),
				`The services table should list ${options.name}`
			).toBeVisible();

			const service = (await notificationServices(page)).find((s) => s.name === options.name);
			if (!service) throw new Error(`The list data has no service named ${options.name}`);
			return service.id;
		},
		{ box: true }
	);
}

export interface NotificationServiceChanges {
	name?: string;
	/** A new Webhook URL; left blank, the stored one stays */
	url?: string;
	/** A new Authorization Header; left blank, the stored one stays */
	authHeader?: string;
	/** Type labels to turn on */
	typesOn?: string[];
	/** Type labels to turn off */
	typesOff?: string[];
}

export interface EditOptions {
	/** Click Save Changes and wait for the list. Default true. */
	save?: boolean;
}

/**
 * Open a service's Edit service page from its row and make `changes`. Fields
 * not in `changes` stay blank, which keeps what is stored. With the default
 * `save`, saves and waits for the list; without it, stays on the form so a
 * scenario can check it.
 */
export async function editNotificationService(
	page: Page,
	name: string,
	changes: NotificationServiceChanges,
	options: EditOptions = {}
): Promise<void> {
	const { save = true } = options;
	await test.step(
		`Edit the notification service ${name}`,
		async () => {
			await onList(page);
			await serviceRow(page, name).getByRole('link', { name: 'Edit service' }).click();
			await expect(page, `Edit service should open ${name}'s edit page`).toHaveURL((url) =>
				url.pathname.startsWith(`${LIST_PATH}/edit/`)
			);
			await waitForHydration(page);

			const main = page.getByRole('main');
			if (changes.name !== undefined) await fillByLabel(main, 'Service Name', changes.name);
			if (changes.url !== undefined) await fillByLabel(main, 'Webhook URL', changes.url);
			if (changes.authHeader !== undefined) {
				await fillByLabel(main, 'Authorization Header', changes.authHeader);
			}
			await setTypes(main, changes.typesOn ?? [], changes.typesOff ?? []);

			if (save) {
				await saveForm(page, { button: 'Save Changes', action: 'edit' });
				const shown = changes.name ?? name;
				await expect(
					serviceRow(page, shown),
					`The services table should list ${shown}`
				).toBeVisible();
			}
		},
		{ box: true }
	);
}

/**
 * Click "Send test notification" in a service's row and return the
 * `testNotification` action's result. The app sends before it answers, so
 * the receiver has the request by then. A failed send is left to the caller.
 */
export async function sendTestNotification(page: Page, name: string): Promise<ActionResult> {
	return await test.step(
		`Send a test notification to ${name}`,
		async () => {
			await onList(page);
			const sent = waitForAction(page, 'testNotification');
			await serviceRow(page, name).getByRole('button', { name: 'Send test notification' }).click();
			return await sent;
		},
		{ box: true }
	);
}

/** Delete a service from its row, confirm the dialog, and wait until the table drops it */
export async function deleteNotificationService(page: Page, name: string): Promise<void> {
	await test.step(
		`Delete the notification service ${name}`,
		async () => {
			await onList(page);
			const row = serviceRow(page, name);
			await row.getByRole('button', { name: 'Delete service' }).click();
			const deleted = waitForAction(page, 'delete');
			await confirmDialog(page, 'Delete Service');
			const result = await deleted;
			expect(result.type, `Deleting ${name} should succeed`).toBe('success');
			await expect(row, `The services table should drop ${name}`).toHaveCount(0);
		},
		{ box: true }
	);
}
