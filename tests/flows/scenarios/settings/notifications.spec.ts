/**
 * - Protects: Webhook notification services, from the form through the row
 *   the app stores, the history it records and the requests the receiver
 *   gets.
 * - Secrets stay on the server: the webhook URL and Authorization header
 *   never reach either page, and fields left blank keep what is stored.
 * - A failed test notification is reported as a failure, not a success.
 * - A service only gets the notification types it turned on, and nothing
 *   once it is deleted.
 */
import type { Page } from '@playwright/test';
import { test, expect } from '$flows/helpers/core/test.ts';
import { saveForm } from '$flows/helpers/core/forms.ts';
import { openPage } from '$flows/helpers/core/nav.ts';
import { createBackup } from '$flows/helpers/settings/backups.ts';
import type { FakeWebhook } from '$flows/helpers/settings/fakeWebhook.ts';
import {
	createNotificationService,
	deleteNotificationService,
	editNotificationService,
	notificationEdit,
	notificationHistory,
	notificationServices,
	sendTestNotification,
	serviceRow
} from '$flows/helpers/settings/notifications.ts';

const SERVICE = 'Flow Webhook';
const RENAMED = 'Renamed Webhook';
const SERVICE_A = 'Backups Webhook';
const SERVICE_B = 'Quiet Webhook';

// Each path holds a secret segment, like a real webhook URL
const PATH = '/hooks/flows-secret-segment-1';
const NEW_PATH = '/hooks/flows-secret-segment-2';
const PATH_A = '/hooks/flows-secret-segment-a';
const PATH_B = '/hooks/flows-secret-segment-b';
const AUTH_HEADER = 'Bearer flows-webhook-token-1';
const NEW_AUTH_HEADER = 'Bearer flows-webhook-token-2';

const BACKUP_SUCCESS = 'Backup Completed (Success)';
const TEST_TITLE = 'Test Notification';
const SENT = 'Test notification sent successfully';
/** What the app's HTTP client reports for a 500 answer */
const HTTP_500 = 'HTTP 500: Internal Server Error';
const FAILED = `Test notification failed: ${HTTP_500}`;
const HEADER_NEEDED = 'Enter the authorization header to change the webhook URL';

/** A notification body as the Webhook service posts it */
interface WebhookBody {
	type: string;
	title: string;
	message: string;
}

/** The requests the receiver got on one path, as method, path, header and body */
function receivedOn(fake: FakeWebhook, path: string) {
	return fake.requests
		.filter((request) => request.path === path)
		.map((request) => ({
			method: request.method,
			authorization: request.headers.authorization,
			body: request.body as WebhookBody
		}));
}

/** An alert with this text, the newest when several show */
const alert = (page: Page, text: string) => page.getByText(text, { exact: true }).last();

/**
 * Fail if a secret is in the raw page data or the rendered page, for each
 * path. Opens each page to read what it rendered.
 */
async function expectNotOnPages(page: Page, paths: string[], secrets: string[]): Promise<void> {
	for (const path of paths) {
		const raw = await (await page.request.get(`${path}/__data.json`)).text();
		await openPage(page, path);
		const html = await page.content();
		for (const secret of secrets) {
			expect(raw.includes(secret), `${path}/__data.json should not hold ${secret}`).toBe(false);
			expect(html.includes(secret), `${path} should not render ${secret}`).toBe(false);
		}
	}
}

/**
 * Flow:
 * 1. The user opens Notifications and clicks Add Service.
 * 2. The user picks Webhook, fills Service Name, Webhook URL and
 *    Authorization Header, and leaves every type off.
 * 3. The user clicks Create Service.
 * 4. The user clicks "Send test notification" in the service's row.
 *
 * Expects:
 * - the receiver gets one POST, on that path, with that Authorization header,
 *   and a test notification body
 * - the success alert shows, and history records success
 * - the list page data has no config
 * - the edit page data has config without the URL or header, and lists both
 *   as stored secrets
 * - neither secret is in either page's raw data or HTML
 */
test('A test notification reaches the stored URL with the stored header', async ({
	page,
	fakeWebhook
}) => {
	const url = fakeWebhook.url(PATH);
	const id = await createNotificationService(page, {
		name: SERVICE,
		url,
		authHeader: AUTH_HEADER
	});

	const result = await sendTestNotification(page, SERVICE);
	expect(result.type, 'The test action should succeed').toBe('success');
	expect(
		receivedOn(fakeWebhook, PATH),
		'The receiver should get one POST with the stored header'
	).toEqual([
		{
			method: 'POST',
			authorization: AUTH_HEADER,
			body: expect.objectContaining({ type: 'test', title: TEST_TITLE })
		}
	]);
	expect(fakeWebhook.requests, 'The receiver should get nothing else').toHaveLength(1);
	await expect(alert(page, SENT), 'The success alert should show').toBeVisible();

	const history = await notificationHistory(page);
	expect(
		history.map((row) => ({
			service: row.service_id,
			type: row.notification_type,
			status: row.status
		})),
		'History should record one successful test'
	).toEqual([{ service: id, type: 'test', status: 'success' }]);

	const [listed] = await notificationServices(page);
	expect(listed.name, 'The list should hold the service').toBe(SERVICE);
	expect(Object.keys(listed), 'The list page data should carry no config').not.toContain('config');

	const edit = await notificationEdit(page, id);
	// A Webhook config holds only the two secrets, so nothing is left once they are removed
	expect(edit.config, 'The edit page config should hold neither secret').toEqual({});
	expect(edit.storedSecrets, 'The edit page should list both secrets as stored').toEqual([
		'webhook_url',
		'auth_header'
	]);

	await expectNotOnPages(
		page,
		['/settings/notifications', `/settings/notifications/edit/${id}`],
		[url, PATH, AUTH_HEADER]
	);
});

/**
 * Flow:
 * 1. The receiver answers 500 on a path.
 * 2. The user creates a service on that path and sends a test.
 *
 * Expects:
 * - the action fails, and an error alert shows the failure
 * - the success alert doesn't show
 * - history records the failure with the error
 */
test('A failed test notification says so', async ({ page, fakeWebhook }) => {
	fakeWebhook.failWith(PATH, 500);
	const id = await createNotificationService(page, {
		name: SERVICE,
		url: fakeWebhook.url(PATH),
		authHeader: AUTH_HEADER
	});

	const result = await sendTestNotification(page, SERVICE);
	expect(receivedOn(fakeWebhook, PATH), 'control: the receiver should get the test').toHaveLength(
		1
	);
	expect(
		{ type: result.type, status: result.status },
		'The test action should fail with 502'
	).toEqual({ type: 'failure', status: 502 });
	await expect(alert(page, FAILED), 'An error alert should show the failure').toBeVisible();
	await expect(
		page.getByText(SENT, { exact: true }),
		'The success alert should not show'
	).toHaveCount(0);

	const history = await notificationHistory(page);
	expect(
		history.map((row) => ({ service: row.service_id, status: row.status, error: row.error })),
		'History should record the failure with its error'
	).toEqual([{ service: id, status: 'failed', error: HTTP_500 }]);
});

/**
 * Flow:
 * 1. The user creates a service and opens Edit service.
 * 2. The user renames it, leaves the URL and header blank, clicks Save
 *    Changes, and sends a test.
 * 3. The user edits again and enters a new URL with the header empty.
 * 4. The user fills the header, saves and sends a test.
 *
 * Expects:
 * - the first test reaches the old path with the old header
 * - in step 3, Save Changes is disabled and says the header is needed
 * - the last test reaches the new path with the new header
 * - the list data has the new name
 */
test('Blank fields keep the stored URL and header', async ({ page, fakeWebhook }) => {
	await createNotificationService(page, {
		name: SERVICE,
		url: fakeWebhook.url(PATH),
		authHeader: AUTH_HEADER
	});

	await editNotificationService(page, SERVICE, { name: RENAMED });
	expect((await sendTestNotification(page, RENAMED)).type, 'The first test should succeed').toBe(
		'success'
	);
	expect(
		receivedOn(fakeWebhook, PATH).map((request) => request.authorization),
		'The first test should reach the old path with the old header'
	).toEqual([AUTH_HEADER]);

	await editNotificationService(page, RENAMED, { url: fakeWebhook.url(NEW_PATH) }, { save: false });
	const save = page.getByRole('main').getByRole('button', { name: 'Save Changes', exact: true });
	await expect(save, 'A new URL without the header should block Save Changes').toBeDisabled();
	await expect(save, 'Save Changes should say the header is needed').toHaveAccessibleDescription(
		HEADER_NEEDED
	);

	await page
		.getByRole('main')
		.getByLabel(/^Authorization Header/)
		.fill(NEW_AUTH_HEADER);
	await saveForm(page, { button: 'Save Changes', action: 'edit' });
	await expect(serviceRow(page, RENAMED), 'The list should show the service').toBeVisible();
	expect((await sendTestNotification(page, RENAMED)).type, 'The last test should succeed').toBe(
		'success'
	);
	expect(
		receivedOn(fakeWebhook, NEW_PATH).map((request) => request.authorization),
		'The last test should reach the new path with the new header'
	).toEqual([NEW_AUTH_HEADER]);
	expect(receivedOn(fakeWebhook, PATH), 'The old path should get nothing more').toHaveLength(1);

	expect(
		(await notificationServices(page)).map((service) => service.name),
		'The list data should hold the new name'
	).toEqual([RENAMED]);
});

/**
 * Flow:
 * 1. The user creates service A with "Backup Completed (Success)" on, and
 *    service B with every type off, each on its own path.
 * 2. The user creates a backup.
 *
 * Expects:
 * - A's path gets one POST, a backup success naming the backup file
 * - B's path gets nothing
 * - history has one row, for A
 */
test('A service only gets the types it turned on', async ({ page, fakeWebhook }) => {
	const idA = await createNotificationService(page, {
		name: SERVICE_A,
		url: fakeWebhook.url(PATH_A),
		types: [BACKUP_SUCCESS]
	});
	await createNotificationService(page, { name: SERVICE_B, url: fakeWebhook.url(PATH_B) });

	const filename = await createBackup(page);

	expect(
		receivedOn(fakeWebhook, PATH_A).map((request) => ({
			method: request.method,
			type: request.body.type,
			message: request.body.message
		})),
		'A should get one backup success naming the file'
	).toEqual([{ method: 'POST', type: 'backup.success', message: filename }]);
	expect(receivedOn(fakeWebhook, PATH_B), 'B should get nothing').toEqual([]);

	const history = await notificationHistory(page);
	expect(
		history.map((row) => ({ service: row.service_id, type: row.notification_type })),
		'History should have one row, for A'
	).toEqual([{ service: idA, type: 'backup.success' }]);
});

/**
 * Flow:
 * 1. The user creates a service with "Backup Completed (Success)" on and
 *    sends a test.
 * 2. The user clicks Delete service, then Delete Service in the dialog.
 * 3. The user creates a backup.
 *
 * Expects:
 * - the row is gone, and the list data no longer has the service
 * - its history rows are gone
 * - the receiver gets no request after the delete
 */
test('A deleted service gets nothing more', async ({ page, fakeWebhook }) => {
	const id = await createNotificationService(page, {
		name: SERVICE,
		url: fakeWebhook.url(PATH),
		types: [BACKUP_SUCCESS]
	});
	expect((await sendTestNotification(page, SERVICE)).type, 'The test should succeed').toBe(
		'success'
	);
	expect(
		(await notificationHistory(page)).map((row) => row.service_id),
		'control: history should hold the test'
	).toEqual([id]);

	await deleteNotificationService(page, SERVICE);
	expect(
		(await notificationServices(page)).map((service) => service.id),
		'The list data should no longer have the service'
	).toEqual([]);
	expect(
		(await notificationHistory(page)).filter((row) => row.service_id === id),
		'Its history rows should be gone'
	).toEqual([]);

	const received = fakeWebhook.requests.length;
	await createBackup(page);
	expect(
		fakeWebhook.requests.slice(received),
		'The receiver should get nothing after the delete'
	).toEqual([]);
});
