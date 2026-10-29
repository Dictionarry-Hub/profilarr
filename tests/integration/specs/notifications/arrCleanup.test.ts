/**
 * Arr cleanup notification - definition + Discord + Ntfy + Webhook + Telegram.
 */

import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, expect, test } from 'vitest';
import type { MockHttpServer } from '#integration/harness/http.ts';
import { PORTS } from '#integration/harness/ports.ts';
import { createMockServer, type CapturedRequest } from './harness/mock-server.ts';
import { DiscordNotifier } from '#notifications/notifiers/discord/DiscordNotifier.ts';
import { NtfyNotifier } from '#notifications/notifiers/ntfy/NtfyNotifier.ts';
import { WebhookNotifier } from '#notifications/notifiers/webhook/WebhookNotifier.ts';
import { TelegramNotifier } from '#notifications/notifiers/telegram/TelegramNotifier.ts';
import { Colors } from '#notifications/notifiers/discord/embed.ts';
import { arrCleanup } from '#notifications/definitions/arrCleanup.ts';
import type { ArrCleanupNotificationParams } from '#notifications/definitions/arrCleanup.ts';

const MOCK_PORT = PORTS.notifications.arrCleanup;
let captured: CapturedRequest[];
let mockServer: MockHttpServer;

let REAL_DISCORD: string | undefined;
let REAL_NTFY_URL: string | undefined;
let REAL_NTFY_TOPIC: string | undefined;
let REAL_WEBHOOK_URL: string | undefined;
let REAL_TELEGRAM_TOKEN: string | undefined;
let REAL_TELEGRAM_CHAT_ID: string | undefined;
try {
	const envPath = fileURLToPath(new URL('./.env', import.meta.url));
	const content = await readFile(envPath, 'utf8');
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx > 0) {
			const key = trimmed.slice(0, eqIdx);
			const value = trimmed.slice(eqIdx + 1);
			if (key === 'TEST_DISCORD_WEBHOOK') REAL_DISCORD = value;
			if (key === 'TEST_NTFY_URL') REAL_NTFY_URL = value;
			if (key === 'TEST_NTFY_TOPIC') REAL_NTFY_TOPIC = value;
			if (key === 'TEST_WEBHOOK_URL') REAL_WEBHOOK_URL = value;
			if (key === 'TEST_TELEGRAM_BOT_TOKEN') REAL_TELEGRAM_TOKEN = value;
			if (key === 'TEST_TELEGRAM_CHAT_ID') REAL_TELEGRAM_CHAT_ID = value;
		}
	}
} catch {
	/* no .env */
}

beforeAll(async () => {
	const mock = await createMockServer(MOCK_PORT);
	captured = mock.captured;
	mockServer = mock.server;
});

afterAll(async () => {
	await mockServer.shutdown();
});

function getAllEmbeds(): Record<string, unknown>[] {
	const embeds: Record<string, unknown>[] = [];
	for (const req of captured) {
		const body = req.body as { embeds?: Record<string, unknown>[] };
		if (body?.embeds) embeds.push(...body.embeds);
	}
	return embeds;
}

// =========================================================================
// Test data
// =========================================================================

function makeSuccessParams(
	overrides: Partial<ArrCleanupNotificationParams> = {}
): ArrCleanupNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		deletedCustomFormats: [
			{ id: 1, name: 'HDR' },
			{ id: 2, name: 'DV' }
		],
		deletedQualityProfiles: [{ id: 10, name: 'Any' }],
		skippedQualityProfiles: [],
		deletedEntities: [
			{ id: 100, title: 'Movie A', externalId: 111 },
			{ id: 101, title: 'Movie B', externalId: 222 },
			{ id: 102, title: 'Movie C', externalId: 333 }
		],
		failedEntities: [],
		...overrides
	};
}

function makePartialParams(): ArrCleanupNotificationParams {
	return {
		instanceName: 'TV',
		instanceType: 'sonarr',
		deletedCustomFormats: [{ id: 1, name: 'HDR' }],
		deletedQualityProfiles: [],
		skippedQualityProfiles: [
			{ item: { id: 10, name: 'Any' }, reason: 'Profile is assigned to media' },
			{ item: { id: 11, name: 'Custom' }, reason: 'Profile is assigned to media' }
		],
		deletedEntities: [
			{ id: 100, title: 'Show A', externalId: 111 },
			{ id: 101, title: 'Show B', externalId: 222 }
		],
		failedEntities: [{ entity: { id: 102, title: 'Show C', externalId: 333 }, reason: 'HTTP 500' }]
	};
}

function makeFailedParams(): ArrCleanupNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		deletedCustomFormats: [],
		deletedQualityProfiles: [],
		skippedQualityProfiles: [
			{ item: { id: 10, name: 'Any' }, reason: 'Profile is assigned to media' }
		],
		deletedEntities: [],
		failedEntities: [{ entity: { id: 100, title: 'Movie X', externalId: 111 }, reason: 'HTTP 500' }]
	};
}

function makeHardErrorParams(): ArrCleanupNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		deletedCustomFormats: [],
		deletedQualityProfiles: [],
		skippedQualityProfiles: [],
		deletedEntities: [],
		failedEntities: [],
		error: 'fetch failed: ECONNREFUSED'
	};
}

function makeSkippedOnlyWithDeletionParams(): ArrCleanupNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		deletedCustomFormats: [{ id: 1, name: 'HDR' }],
		deletedQualityProfiles: [],
		skippedQualityProfiles: [
			{ item: { id: 10, name: 'Any' }, reason: 'Profile is assigned to media' }
		],
		deletedEntities: [],
		failedEntities: []
	};
}

// =========================================================================
// Definition
// =========================================================================

test('type includes status', () => {
	expect(arrCleanup(makeSuccessParams()).type).toStrictEqual('arr.cleanup.success');
	expect(arrCleanup(makePartialParams()).type).toStrictEqual('arr.cleanup.partial');
	expect(arrCleanup(makeFailedParams()).type).toStrictEqual('arr.cleanup.failed');
	expect(arrCleanup(makeHardErrorParams()).type).toStrictEqual('arr.cleanup.failed');
});

test('severity maps correctly', () => {
	expect(arrCleanup(makeSuccessParams()).severity).toStrictEqual('success');
	expect(arrCleanup(makePartialParams()).severity).toStrictEqual('warning');
	expect(arrCleanup(makeFailedParams()).severity).toStrictEqual('error');
	expect(arrCleanup(makeHardErrorParams()).severity).toStrictEqual('error');
});

test('title includes instance name', () => {
	expect(arrCleanup(makeSuccessParams()).title.includes('Movies')).toStrictEqual(true);
	expect(arrCleanup(makePartialParams()).title.includes('TV')).toStrictEqual(true);
});

test('title includes instance type', () => {
	expect(arrCleanup(makeSuccessParams()).title.includes('Radarr')).toStrictEqual(true);
	expect(arrCleanup(makePartialParams()).title.includes('Sonarr')).toStrictEqual(true);
});

test('title reflects status', () => {
	expect(arrCleanup(makeSuccessParams()).title.includes('Complete')).toStrictEqual(true);
	expect(arrCleanup(makePartialParams()).title.includes('Partial')).toStrictEqual(true);
	expect(arrCleanup(makeFailedParams()).title.includes('Failed')).toStrictEqual(true);
	expect(arrCleanup(makeHardErrorParams()).title.includes('Failed')).toStrictEqual(true);
});

test('entity label: Radarr -> Movies', () => {
	const notification = arrCleanup(makeSuccessParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const deleted = sections.find((s) => s.kind === 'section' && s.title === 'Deleted');
	expect(deleted).not.toBeOneOf([null, undefined]);
	if (deleted?.kind === 'section') {
		const moviesGroup = deleted.items?.find((g) => g.label === 'Movies');
		expect(moviesGroup).not.toBeOneOf([null, undefined]);
	}
});

test('deleted section labels are capitalized', () => {
	const notification = arrCleanup(makeSuccessParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const deleted = sections.find((s) => s.kind === 'section' && s.title === 'Deleted');
	expect(deleted).not.toBeOneOf([null, undefined]);
	if (deleted?.kind === 'section') {
		const labels = deleted.items?.map((g) => g.label) ?? [];
		expect(labels.includes('Profiles')).toStrictEqual(true);
		expect(labels.includes('Formats')).toStrictEqual(true);
		expect(labels.includes('Movies')).toStrictEqual(true);
	}
});

test('entity label: Sonarr -> Series', () => {
	const notification = arrCleanup(makePartialParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const failedSection = sections.find((s) => s.kind === 'section' && s.title === 'Failed Series');
	expect(failedSection).not.toBeOneOf([null, undefined]);
});

test('skipped QPs flip success to partial even with deletions', () => {
	const notification = arrCleanup(makeSkippedOnlyWithDeletionParams());
	expect(notification.type).toStrictEqual('arr.cleanup.partial');
	expect(notification.severity).toStrictEqual('warning');
});

test('skipped QPs only with no deletions yields failed', () => {
	const params: ArrCleanupNotificationParams = {
		instanceName: 'Movies',
		instanceType: 'radarr',
		deletedCustomFormats: [],
		deletedQualityProfiles: [],
		skippedQualityProfiles: [
			{ item: { id: 10, name: 'Any' }, reason: 'Profile is assigned to media' }
		],
		deletedEntities: [],
		failedEntities: []
	};
	const notification = arrCleanup(params);
	expect(notification.type).toStrictEqual('arr.cleanup.failed');
	expect(notification.severity).toStrictEqual('error');
});

test('hard error variant emits Error section with full error text', () => {
	const notification = arrCleanup(makeHardErrorParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const errorSection = sections.find((s) => s.kind === 'section' && s.title === 'Error');
	expect(errorSection).not.toBeOneOf([null, undefined]);
	if (errorSection?.kind === 'section') {
		expect(errorSection.content.includes('ECONNREFUSED')).toStrictEqual(true);
	}
});

test('hard error message is first line of error', () => {
	const params: ArrCleanupNotificationParams = {
		...makeHardErrorParams(),
		error: 'fetch failed: ECONNREFUSED\nstack trace follows\n...'
	};
	const notification = arrCleanup(params);
	expect(notification.message).toStrictEqual('fetch failed: ECONNREFUSED');
});

test('definition emits no field blocks (counts only live in message + sections)', () => {
	for (const params of [makeSuccessParams(), makePartialParams(), makeFailedParams()]) {
		const notification = arrCleanup(params);
		const fields = notification.blocks?.filter((b) => b.kind === 'field') ?? [];
		expect(fields.length).toStrictEqual(0);
	}
});

test('hard error single-line message equals error text', () => {
	const notification = arrCleanup(makeHardErrorParams());
	expect(notification.message.includes('ECONNREFUSED')).toStrictEqual(true);
});

test('success message reports deleted total', () => {
	const notification = arrCleanup(makeSuccessParams());
	// 2 CFs + 1 QP + 3 entities = 6
	expect(notification.message.includes('6')).toStrictEqual(true);
});

test('partial message reports both counts', () => {
	const notification = arrCleanup(makePartialParams());
	// deleted: 1 CF + 2 entities = 3. non-successes: 2 skipped + 1 failed = 3.
	expect(notification.message.includes('3')).toStrictEqual(true);
	expect(notification.message.toLowerCase().includes('not deleted')).toStrictEqual(true);
});

test('failed (soft) message reports non-success count', () => {
	const notification = arrCleanup(makeFailedParams());
	// 1 skipped + 1 failed = 2
	expect(notification.message.includes('2')).toStrictEqual(true);
});

test('deleted section lists item names', () => {
	const notification = arrCleanup(makeSuccessParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const deletedSection = sections.find((s) => s.kind === 'section' && s.title === 'Deleted');
	expect(deletedSection).not.toBeOneOf([null, undefined]);
	if (deletedSection?.kind === 'section') {
		expect(deletedSection.items).not.toBeOneOf([null, undefined]);
		const allNames = deletedSection.items!.flatMap((g) => g.items);
		expect(allNames.includes('HDR')).toStrictEqual(true);
		expect(allNames.includes('Any')).toStrictEqual(true);
		expect(allNames.includes('Movie A')).toStrictEqual(true);
	}
});

test('skipped section groups by reason', () => {
	const notification = arrCleanup(makePartialParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const skippedSection = sections.find(
		(s) => s.kind === 'section' && s.title === 'Skipped Profiles'
	);
	expect(skippedSection).not.toBeOneOf([null, undefined]);
	if (skippedSection?.kind === 'section') {
		expect(skippedSection.items).not.toBeOneOf([null, undefined]);
		const group = skippedSection.items!.find((g) => g.label === 'Profile is assigned to media');
		expect(group).not.toBeOneOf([null, undefined]);
		expect(group!.items.length).toStrictEqual(2);
		expect(group!.items.includes('Any')).toStrictEqual(true);
		expect(group!.items.includes('Custom')).toStrictEqual(true);
	}
});

test('failed entities section groups by reason', () => {
	const notification = arrCleanup(makePartialParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	const failedSection = sections.find((s) => s.kind === 'section' && s.title === 'Failed Series');
	expect(failedSection).not.toBeOneOf([null, undefined]);
	if (failedSection?.kind === 'section') {
		expect(failedSection.items).not.toBeOneOf([null, undefined]);
		const group = failedSection.items!.find((g) => g.label === 'HTTP 500');
		expect(group).not.toBeOneOf([null, undefined]);
		expect(group!.items.includes('Show C')).toStrictEqual(true);
	}
});

// =========================================================================
// Discord
// =========================================================================

test('discord: success uses correct color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.SUCCESS);
});

test('discord: partial uses warning color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makePartialParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.WARNING);
});

test('discord: failed uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makeFailedParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.ERROR);
});

test('discord: hard error uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makeHardErrorParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.ERROR);
});

test('discord: section items render with names', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);

	// The Deleted SectionBlock renders as a field whose VALUE contains item names.
	// (FieldBlocks with names like "Deleted Formats" just hold counts.)
	const deletedSection = allFields.find(
		(f) => f.value.includes('HDR') && f.value.includes('Movie A')
	);
	expect(deletedSection).not.toBeOneOf([null, undefined]);
});

test('discord: skipped reason labels appear', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makePartialParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);
	const skippedSection = allFields.find((f) => f.value.includes('Profile is assigned to media'));
	expect(skippedSection).not.toBeOneOf([null, undefined]);
});

// =========================================================================
// Ntfy
// =========================================================================

test('ntfy: success maps to priority 3', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(3);
	expect(payload?.tags).toStrictEqual(['white_check_mark']);
});

test('ntfy: partial maps to priority 4', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrCleanup(makePartialParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(4);
	expect(payload?.tags).toStrictEqual(['warning']);
});

test('ntfy: failed maps to priority 5', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrCleanup(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(5);
	expect(payload?.tags).toStrictEqual(['x']);
});

test('ntfy: message carries summary, omits section item names', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	const message = payload?.message as string;
	// Summary message survives
	expect(message.includes('Deleted')).toStrictEqual(true);
	expect(message.includes('6')).toStrictEqual(true);
	// Section item names should not appear
	expect(message.includes('HDR')).toStrictEqual(false);
	expect(message.includes('Movie A')).toStrictEqual(false);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: sends full notification with blocks and items', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('arr.cleanup.success');
	expect(payload?.severity).toStrictEqual('success');
	const blocks = payload?.blocks as { kind: string; items?: unknown[] }[];
	expect(blocks).not.toBeOneOf([null, undefined]);
	const withItems = blocks.filter((b) => b.kind === 'section' && b.items);
	// At least the "Deleted" section should have items
	expect(withItems.length >= 1).toStrictEqual(true);
});

test('webhook: hard error passes through message + Error section', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrCleanup(makeHardErrorParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('arr.cleanup.failed');
	expect((payload?.message as string).includes('ECONNREFUSED')).toStrictEqual(true);
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];
	const errorBlock = blocks.find((b) => b.kind === 'section' && b.title === 'Error');
	expect(errorBlock).not.toBeOneOf([null, undefined]);
	expect(errorBlock!.content?.includes('ECONNREFUSED')).toStrictEqual(true);
});

// =========================================================================
// Telegram
// =========================================================================

const MOCK_TOKEN = 'test-token-123';

test('telegram: success has ✅ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u2705')).toStrictEqual(true);
});

test('telegram: partial has ⚠️ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrCleanup(makePartialParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u26A0\uFE0F')).toStrictEqual(true);
});

test('telegram: failed has ❌ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrCleanup(makeFailedParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u274C')).toStrictEqual(true);
});

test('telegram: message includes instance name but omits item names', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.includes('Movies')).toStrictEqual(true);
	expect(text.includes('HDR')).toStrictEqual(false);
	expect(text.includes('Movie A')).toStrictEqual(false);
});

// =========================================================================
// Real sends (skipped without .env)
// =========================================================================

test('real: sends success to Discord', async () => {
	if (!REAL_DISCORD) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));
});

test('real: sends partial to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makePartialParams()));
});

test('real: sends hard error to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrCleanup(makeHardErrorParams()));
});

test('real: sends success to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));
});

test('real: sends success to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));
});

test('real: sends success to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(arrCleanup(makeSuccessParams()));
});
