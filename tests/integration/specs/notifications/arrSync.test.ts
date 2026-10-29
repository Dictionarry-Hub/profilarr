/**
 * Arr sync notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { arrSync } from '#notifications/definitions/arrSync.ts';
import type { ArrSyncNotificationParams } from '#notifications/definitions/arrSync.ts';

const MOCK_PORT = PORTS.notifications.arrSync;
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
	expect(arrSync(makeSuccessParams()).type).toStrictEqual('arr.sync.success');
	expect(arrSync(makePartialParams()).type).toStrictEqual('arr.sync.partial');
	expect(arrSync(makeFailedParams()).type).toStrictEqual('arr.sync.failed');
});

test('severity maps correctly', () => {
	expect(arrSync(makeSuccessParams()).severity).toStrictEqual('success');
	expect(arrSync(makePartialParams()).severity).toStrictEqual('warning');
	expect(arrSync(makeFailedParams()).severity).toStrictEqual('error');
});

test('title includes instance name', () => {
	expect(arrSync(makeSuccessParams()).title.includes('Movies')).toStrictEqual(true);
});

test('title includes instance type', () => {
	expect(arrSync(makeSuccessParams()).title.includes('Radarr')).toStrictEqual(true);
});

test('title reflects status', () => {
	expect(arrSync(makeSuccessParams()).title.includes('Complete')).toStrictEqual(true);
	expect(arrSync(makePartialParams()).title.includes('Partial')).toStrictEqual(true);
	expect(arrSync(makeFailedParams()).title.includes('Failed')).toStrictEqual(true);
});

test('message includes section count', () => {
	expect(arrSync(makeSuccessParams()).message.includes('3')).toStrictEqual(true);
});

test('successful sections produce section blocks with items', () => {
	const notification = arrSync(makeSuccessParams());
	const qpBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Quality Profiles'
	);
	expect(qpBlock).not.toBeOneOf([null, undefined]);
	if (qpBlock?.kind === 'section') {
		expect(qpBlock.items).not.toBeOneOf([null, undefined]);
		const created = qpBlock.items!.find((i) => i.label === 'created');
		const updated = qpBlock.items!.find((i) => i.label === 'updated');
		expect(created).not.toBeOneOf([null, undefined]);
		expect(updated).not.toBeOneOf([null, undefined]);
		expect(created!.items.length).toStrictEqual(3);
		expect(updated!.items.length).toStrictEqual(12);
		expect(created!.items.includes('HD Bluray')).toStrictEqual(true);
		expect(updated!.items.includes('Remux')).toStrictEqual(true);
	}
});

test('message summarizes counts per section', () => {
	const notification = arrSync(makeSuccessParams());
	expect(notification.message.includes('12 updated')).toStrictEqual(true);
	expect(notification.message.includes('3 created')).toStrictEqual(true);
	expect(notification.message.includes('Quality Profiles')).toStrictEqual(true);
});

test('failed sections produce no blocks, errors in message', () => {
	const notification = arrSync(makeFailedParams());
	const blocks = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	expect(blocks.length).toStrictEqual(0);
	expect(notification.message.includes('API returned 401')).toStrictEqual(true);
	expect(notification.message.includes('connection timeout')).toStrictEqual(true);
});

test('partial: blocks for success sections, errors in message', () => {
	const notification = arrSync(makePartialParams());
	const blocks = notification.blocks?.filter((b) => b.kind === 'section') ?? [];
	expect(blocks.length).toStrictEqual(2);

	const qpBlock = blocks.find((b) => b.kind === 'section' && b.title === 'Quality Profiles');
	expect(qpBlock).not.toBeOneOf([null, undefined]);
	if (qpBlock?.kind === 'section') {
		expect(qpBlock.items).not.toBeOneOf([null, undefined]);
	}

	expect(notification.message.includes('connection timeout')).toStrictEqual(true);
});

test('all sections have display names', () => {
	const notification = arrSync(makeSuccessParams());
	const titles = notification.blocks
		?.filter((b) => b.kind === 'section')
		.map((b) => (b.kind === 'section' ? b.title : ''));
	expect(titles?.includes('Quality Profiles')).toStrictEqual(true);
	expect(titles?.includes('Delay Profiles')).toStrictEqual(true);
	expect(titles?.includes('Media Management')).toStrictEqual(true);
});

test('update-only section omits created group', () => {
	const notification = arrSync(makeSuccessParams());
	const dpBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Delay Profiles'
	);
	if (dpBlock?.kind === 'section') {
		expect(dpBlock.items).not.toBeOneOf([null, undefined]);
		const created = dpBlock.items!.find((i) => i.label === 'created');
		expect(created).toStrictEqual(undefined);
		const updated = dpBlock.items!.find((i) => i.label === 'updated');
		expect(updated).not.toBeOneOf([null, undefined]);
		expect(updated!.items.includes('Standard')).toStrictEqual(true);
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

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.SUCCESS);
});

test('discord: partial uses warning color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makePartialParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.WARNING);
});

test('discord: failed uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrSync(makeFailedParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.ERROR);
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
	expect(qpField).not.toBeOneOf([null, undefined]);
	expect(qpField!.value.includes('HD Bluray')).toStrictEqual(true);
	expect(qpField!.value.includes('Remux')).toStrictEqual(true);
	expect(qpField!.value.includes('🆕')).toStrictEqual(true);
	expect(qpField!.value.includes('✏️')).toStrictEqual(true);
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
	expect(allFields.length).toStrictEqual(0);

	const description = embeds[0]?.description as string;
	expect(description.includes('API returned 401')).toStrictEqual(true);
	expect(description.includes('connection timeout')).toStrictEqual(true);
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
	expect(payload?.priority).toStrictEqual(3);
	expect(payload?.tags).toStrictEqual(['white_check_mark']);
});

test('ntfy: failed maps to priority 5', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrSync(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(5);
	expect(payload?.tags).toStrictEqual(['x']);
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
	expect(message.includes('Quality Profiles')).toStrictEqual(true);
	expect(message.includes('12 updated')).toStrictEqual(true);
	expect(message.includes('HD Bluray')).toStrictEqual(false);
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
	expect(payload?.type).toStrictEqual('arr.sync.success');
	expect(payload?.severity).toStrictEqual('success');
	const blocks = payload?.blocks as { kind: string; items?: unknown[] }[];
	expect(blocks).not.toBeOneOf([null, undefined]);
	const withItems = blocks.filter((b) => b.kind === 'section' && b.items);
	expect(withItems.length).toStrictEqual(3);
});

test('webhook: failed sections have no items', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrSync(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('arr.sync.failed');
	const blocks = payload?.blocks as { kind: string; items?: unknown[] }[];
	const withItems = blocks.filter((b) => b.items);
	expect(withItems.length).toStrictEqual(0);
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
	expect(text.startsWith('\u2705')).toStrictEqual(true);
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
	expect(text.startsWith('\u274C')).toStrictEqual(true);
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
	expect(text.startsWith('\u26A0\uFE0F')).toStrictEqual(true);
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
	expect(text.includes('Movies')).toStrictEqual(true);
	// Section item names should not appear (summary tier)
	expect(text.includes('HD Bluray')).toStrictEqual(false);
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
