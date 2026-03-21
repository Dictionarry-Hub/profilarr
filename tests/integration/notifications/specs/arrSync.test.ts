/**
 * Arr sync notification - definition + Discord + Ntfy + Webhook + Telegram.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { NtfyNotifier } from '$notifications/notifiers/ntfy/NtfyNotifier.ts';
import { WebhookNotifier } from '$notifications/notifiers/webhook/WebhookNotifier.ts';
import { TelegramNotifier } from '$notifications/notifiers/telegram/TelegramNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import { arrSync } from '$notifications/definitions/arrSync.ts';
import type { ArrSyncNotificationParams } from '$notifications/definitions/arrSync.ts';

const MOCK_PORT = 7137;
let captured: CapturedRequest[];
let mockServer: Deno.HttpServer;

let REAL_DISCORD: string | undefined;
let REAL_NTFY_URL: string | undefined;
let REAL_NTFY_TOPIC: string | undefined;
let REAL_WEBHOOK_URL: string | undefined;
let REAL_TELEGRAM_TOKEN: string | undefined;
let REAL_TELEGRAM_CHAT_ID: string | undefined;
try {
	const envPath = new URL('../.env', import.meta.url).pathname;
	const content = await Deno.readTextFile(envPath);
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

setup(() => {
	const mock = createMockServer(MOCK_PORT);
	captured = mock.captured;
	mockServer = mock.server;
});

teardown(async () => {
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
	overrides: Partial<ArrSyncNotificationParams> = {}
): ArrSyncNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		sections: [
			{
				section: 'qualityProfiles',
				success: true,
				items: [
					{ name: 'HD Bluray', action: 'created' },
					{ name: 'UHD Bluray', action: 'created' },
					{ name: 'Web-Only', action: 'created' },
					{ name: 'Remux', action: 'updated' },
					{ name: 'Any', action: 'updated' },
					{ name: 'SD', action: 'updated' },
					{ name: 'Ultra-HD', action: 'updated' },
					{ name: 'Anime', action: 'updated' },
					{ name: '720p', action: 'updated' },
					{ name: '1080p', action: 'updated' },
					{ name: '2160p', action: 'updated' },
					{ name: 'Low Quality', action: 'updated' },
					{ name: 'Mid Quality', action: 'updated' },
					{ name: 'High Quality', action: 'updated' },
					{ name: 'Top Quality', action: 'updated' }
				]
			},
			{
				section: 'delayProfiles',
				success: true,
				items: [{ name: 'Standard', action: 'updated' }]
			},
			{
				section: 'mediaManagement',
				success: true,
				items: [
					{ name: 'Media Settings', action: 'updated' },
					{ name: 'Naming', action: 'updated' },
					{ name: 'Quality Definitions', action: 'updated' }
				]
			}
		],
		...overrides
	};
}

function makePartialParams(): ArrSyncNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		sections: [
			{
				section: 'qualityProfiles',
				success: true,
				items: [
					{ name: 'HD Bluray', action: 'created' },
					{ name: 'Remux', action: 'updated' }
				]
			},
			{
				section: 'delayProfiles',
				success: true,
				items: [{ name: 'Standard', action: 'updated' }]
			},
			{
				section: 'mediaManagement',
				success: false,
				error: 'connection timeout'
			}
		]
	};
}

function makeFailedParams(): ArrSyncNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		sections: [
			{
				section: 'qualityProfiles',
				success: false,
				error: 'API returned 401'
			},
			{
				section: 'mediaManagement',
				success: false,
				error: 'connection timeout'
			}
		]
	};
}

// =========================================================================
// Definition
// =========================================================================

test('type includes status', () => {
	assertEquals(arrSync(makeSuccessParams()).type, 'arr.sync.success');
	assertEquals(arrSync(makePartialParams()).type, 'arr.sync.partial');
	assertEquals(arrSync(makeFailedParams()).type, 'arr.sync.failed');
});

test('severity maps correctly', () => {
	assertEquals(arrSync(makeSuccessParams()).severity, 'success');
	assertEquals(arrSync(makePartialParams()).severity, 'warning');
	assertEquals(arrSync(makeFailedParams()).severity, 'error');
});

test('title includes instance name', () => {
	assertEquals(arrSync(makeSuccessParams()).title.includes('Movies'), true);
});

test('title includes instance type', () => {
	assertEquals(arrSync(makeSuccessParams()).title.includes('Radarr'), true);
});

test('title reflects status', () => {
	assertEquals(arrSync(makeSuccessParams()).title.includes('Complete'), true);
	assertEquals(arrSync(makePartialParams()).title.includes('Partial'), true);
	assertEquals(arrSync(makeFailedParams()).title.includes('Failed'), true);
});

test('message includes section count', () => {
	assertEquals(arrSync(makeSuccessParams()).message.includes('3'), true);
});

test('successful sections produce section blocks with items', () => {
	const notification = arrSync(makeSuccessParams());
	const qpBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Quality Profiles'
	);
	assertExists(qpBlock);
	if (qpBlock?.kind === 'section') {
		assertExists(qpBlock.items);
		const created = qpBlock.items!.find((i) => i.label === 'created');
		const updated = qpBlock.items!.find((i) => i.label === 'updated');
		assertExists(created);
		assertExists(updated);
		assertEquals(created!.items.length, 3);
		assertEquals(updated!.items.length, 12);
		assertEquals(created!.items.includes('HD Bluray'), true);
		assertEquals(updated!.items.includes('Remux'), true);
	}
});

test('message summarizes counts per section', () => {
	const notification = arrSync(makeSuccessParams());
	assertEquals(notification.message.includes('12 updated'), true);
	assertEquals(notification.message.includes('3 created'), true);
	assertEquals(notification.message.includes('Quality Profiles'), true);
});

test('failed sections produce no blocks, errors in message', () => {
	const notification = arrSync(makeFailedParams());
	const blocks = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	assertEquals(blocks.length, 0);
	assertEquals(notification.message.includes('API returned 401'), true);
	assertEquals(notification.message.includes('connection timeout'), true);
});

test('partial: blocks for success sections, errors in message', () => {
	const notification = arrSync(makePartialParams());
	const blocks = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	assertEquals(blocks.length, 2);

	const qpBlock = blocks.find((b) => b.kind === 'section' && b.title === 'Quality Profiles');
	assertExists(qpBlock);
	if (qpBlock?.kind === 'section') {
		assertExists(qpBlock.items);
	}

	assertEquals(notification.message.includes('connection timeout'), true);
});

test('all sections have display names', () => {
	const notification = arrSync(makeSuccessParams());
	const titles = notification.blocks
		?.filter((b) => b.kind === 'section')
		.map((b) => (b.kind === 'section' ? b.title : ''));
	assertEquals(titles?.includes('Quality Profiles'), true);
	assertEquals(titles?.includes('Delay Profiles'), true);
	assertEquals(titles?.includes('Media Management'), true);
});

test('update-only section omits created group', () => {
	const notification = arrSync(makeSuccessParams());
	const dpBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Delay Profiles'
	);
	if (dpBlock?.kind === 'section') {
		assertExists(dpBlock.items);
		const created = dpBlock.items!.find((i) => i.label === 'created');
		assertEquals(created, undefined);
		const updated = dpBlock.items!.find((i) => i.label === 'updated');
		assertExists(updated);
		assertEquals(updated!.items.includes('Standard'), true);
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
	await notifier.notify(arrSync(makeSuccessParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.SUCCESS);
});

test('discord: partial uses warning color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makePartialParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.WARNING);
});

test('discord: failed uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makeFailedParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.ERROR);
});

test('discord: section items render in compact format', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makeSuccessParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);

	const qpField = allFields.find((f) => f.name.startsWith('Quality Profiles'));
	assertExists(qpField);
	assertEquals(qpField!.value.includes('HD Bluray'), true);
	assertEquals(qpField!.value.includes('Remux'), true);
	assertEquals(qpField!.value.includes('🆕'), true);
	assertEquals(qpField!.value.includes('✏️'), true);
});

test('discord: failed sections have no fields, errors in description', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makeFailedParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);
	assertEquals(allFields.length, 0);

	const description = embeds[0]?.description as string;
	assertEquals(description.includes('API returned 401'), true);
	assertEquals(description.includes('connection timeout'), true);
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
	await notifier.notify(arrSync(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 3);
	assertEquals(payload?.tags, ['white_check_mark']);
});

test('ntfy: failed maps to priority 5', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrSync(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 5);
	assertEquals(payload?.tags, ['x']);
});

test('ntfy: message includes per-section summaries but omits item names', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrSync(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	const message = payload?.message as string;
	assertEquals(message.includes('Quality Profiles'), true);
	assertEquals(message.includes('12 updated'), true);
	assertEquals(message.includes('HD Bluray'), false);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: sends full notification with section items', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrSync(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'arr.sync.success');
	assertEquals(payload?.severity, 'success');
	const blocks = payload?.blocks as { kind: string; items?: unknown[] }[];
	assertExists(blocks);
	const withItems = blocks.filter((b) => b.kind === 'section' && b.items);
	assertEquals(withItems.length, 3);
});

test('webhook: failed sections have no items', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrSync(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'arr.sync.failed');
	const blocks = payload?.blocks as { kind: string; items?: unknown[] }[];
	const withItems = blocks.filter((b) => b.items);
	assertEquals(withItems.length, 0);
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
	await notifier.notify(arrSync(makeSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u2705'), true);
});

test('telegram: failed has ❌ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrSync(makeFailedParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u274C'), true);
});

test('telegram: partial has ⚠️ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrSync(makePartialParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u26A0\uFE0F'), true);
});

test('telegram: message includes title but omits section item names', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrSync(makeSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.includes('Movies'), true);
	// Section item names should not appear (summary tier)
	assertEquals(text.includes('HD Bluray'), false);
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
	await notifier.notify(arrSync(makeSuccessParams()));
});

test('real: sends partial to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makePartialParams()));
});

test('real: sends failed to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makeFailedParams()));
});

test('real: sends sonarr success to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(
		arrSync(
			makeSuccessParams({
				instanceName: 'TV Shows',
				instanceType: 'sonarr'
			})
		)
	);
});

test('real: sends success to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(arrSync(makeSuccessParams()));
});

test('real: sends success to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(arrSync(makeSuccessParams()));
});

test('real: sends failed to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(arrSync(makeFailedParams()));
});

test('real: sends success to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(arrSync(makeSuccessParams()));
});

await run();
