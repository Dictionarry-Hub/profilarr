/**
 * PCD sync notification - definition + Discord + Ntfy + Webhook + Telegram.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { NtfyNotifier } from '$notifications/notifiers/ntfy/NtfyNotifier.ts';
import { WebhookNotifier } from '$notifications/notifiers/webhook/WebhookNotifier.ts';
import { TelegramNotifier } from '$notifications/notifiers/telegram/TelegramNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import {
	pcdUpdatesAvailable,
	pcdSyncSuccess,
	pcdSyncFailed
} from '$notifications/definitions/pcdSync.ts';
import type {
	PcdUpdatesAvailableParams,
	PcdSyncSuccessParams,
	PcdSyncFailedParams
} from '$notifications/definitions/pcdSync.ts';

const MOCK_PORT = 7138;
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

function makeUpdatesAvailableParams(
	overrides: Partial<PcdUpdatesAvailableParams> = {}
): PcdUpdatesAvailableParams {
	return {
		name: 'Dictionarry',
		commitsBehind: 3,
		commitMessages: [
			'feat: add position to quality groups',
			'fix: bluray scoring',
			'refactor: naming conventions'
		],
		...overrides
	};
}

function makeSyncSuccessParams(
	overrides: Partial<PcdSyncSuccessParams> = {}
): PcdSyncSuccessParams {
	return {
		name: 'Dictionarry',
		commitsPulled: 3,
		commitMessages: [
			'feat: add position to quality groups',
			'fix: bluray scoring',
			'refactor: naming conventions'
		],
		...overrides
	};
}

function makeSyncFailedParams(overrides: Partial<PcdSyncFailedParams> = {}): PcdSyncFailedParams {
	return {
		name: 'Dictionarry',
		error: 'authentication failed',
		...overrides
	};
}

// =========================================================================
// Definition — updates_available
// =========================================================================

test('updates_available: type is pcd.updates_available', () => {
	assertEquals(pcdUpdatesAvailable(makeUpdatesAvailableParams()).type, 'pcd.updates_available');
});

test('updates_available: severity is info', () => {
	assertEquals(pcdUpdatesAvailable(makeUpdatesAvailableParams()).severity, 'info');
});

test('updates_available: title includes database name', () => {
	assertEquals(
		pcdUpdatesAvailable(makeUpdatesAvailableParams()).title.includes('Dictionarry'),
		true
	);
});

test('updates_available: title includes Available', () => {
	assertEquals(pcdUpdatesAvailable(makeUpdatesAvailableParams()).title.includes('Available'), true);
});

test('updates_available: message includes commit count', () => {
	assertEquals(pcdUpdatesAvailable(makeUpdatesAvailableParams()).message.includes('3'), true);
});

test('updates_available: changes section contains commit messages', () => {
	const notification = pcdUpdatesAvailable(makeUpdatesAvailableParams());
	const changesBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Changes'
	);
	assertExists(changesBlock);
	if (changesBlock?.kind === 'section') {
		assertEquals(changesBlock.content.includes('add position to quality groups'), true);
		assertEquals(changesBlock.content.includes('bluray scoring'), true);
		assertEquals(changesBlock.content.includes('naming conventions'), true);
	}
});

test('updates_available: no changes section when no commit messages', () => {
	const notification = pcdUpdatesAvailable(makeUpdatesAvailableParams({ commitMessages: [] }));
	const changesBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Changes'
	);
	assertEquals(changesBlock, undefined);
});

// =========================================================================
// Definition — sync_success
// =========================================================================

test('sync_success: type is pcd.sync_success', () => {
	assertEquals(pcdSyncSuccess(makeSyncSuccessParams()).type, 'pcd.sync_success');
});

test('sync_success: severity is success', () => {
	assertEquals(pcdSyncSuccess(makeSyncSuccessParams()).severity, 'success');
});

test('sync_success: title includes database name', () => {
	assertEquals(pcdSyncSuccess(makeSyncSuccessParams()).title.includes('Dictionarry'), true);
});

test('sync_success: title includes Synced', () => {
	assertEquals(pcdSyncSuccess(makeSyncSuccessParams()).title.includes('Synced'), true);
});

test('sync_success: message includes commit count', () => {
	assertEquals(pcdSyncSuccess(makeSyncSuccessParams()).message.includes('3'), true);
});

test('sync_success: changes section contains commit messages', () => {
	const notification = pcdSyncSuccess(makeSyncSuccessParams());
	const changesBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Changes'
	);
	assertExists(changesBlock);
	if (changesBlock?.kind === 'section') {
		assertEquals(changesBlock.content.includes('add position to quality groups'), true);
		assertEquals(changesBlock.content.includes('bluray scoring'), true);
	}
});

test('sync_success: schema section present when schema changed', () => {
	const notification = pcdSyncSuccess(
		makeSyncSuccessParams({ schemaUpdate: { from: 'v1.0', to: 'v1.1' } })
	);
	const schemaBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Schema Updated'
	);
	assertExists(schemaBlock);
	if (schemaBlock?.kind === 'section') {
		assertEquals(schemaBlock.content.includes('v1.0'), true);
		assertEquals(schemaBlock.content.includes('v1.1'), true);
	}
});

test('sync_success: no schema section when schema did not change', () => {
	const notification = pcdSyncSuccess(makeSyncSuccessParams());
	const schemaBlock = notification.blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Schema Updated'
	);
	assertEquals(schemaBlock, undefined);
});

// =========================================================================
// Definition — sync_failed
// =========================================================================

test('sync_failed: type is pcd.sync_failed', () => {
	assertEquals(pcdSyncFailed(makeSyncFailedParams()).type, 'pcd.sync_failed');
});

test('sync_failed: severity is error', () => {
	assertEquals(pcdSyncFailed(makeSyncFailedParams()).severity, 'error');
});

test('sync_failed: title includes database name', () => {
	assertEquals(pcdSyncFailed(makeSyncFailedParams()).title.includes('Dictionarry'), true);
});

test('sync_failed: title includes Failed', () => {
	assertEquals(pcdSyncFailed(makeSyncFailedParams()).title.includes('Failed'), true);
});

test('sync_failed: message includes error', () => {
	assertEquals(
		pcdSyncFailed(makeSyncFailedParams()).message.includes('authentication failed'),
		true
	);
});

test('sync_failed: no blocks', () => {
	const notification = pcdSyncFailed(makeSyncFailedParams());
	assertEquals(notification.blocks?.length ?? 0, 0);
});

// =========================================================================
// Discord
// =========================================================================

test('discord: updates_available uses info color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(pcdUpdatesAvailable(makeUpdatesAvailableParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.INFO);
});

test('discord: sync_success uses success color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.SUCCESS);
});

test('discord: sync_failed uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.ERROR);
});

test('discord: changes section renders in embed', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);
	const descriptions = embeds.map((e) => e.description as string).filter(Boolean);

	// Changes should appear somewhere in the embed (fields or description)
	const allText = [...allFields.map((f) => `${f.name} ${f.value}`), ...descriptions].join(' ');
	assertEquals(allText.includes('add position to quality groups'), true);
});

// =========================================================================
// Ntfy
// =========================================================================

test('ntfy: updates_available maps to priority 3', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(pcdUpdatesAvailable(makeUpdatesAvailableParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 3);
});

test('ntfy: sync_success maps to priority 3', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 3);
});

test('ntfy: sync_failed maps to priority 5', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 5);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: sync_success sends full notification with blocks', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'pcd.sync_success');
	assertEquals(payload?.severity, 'success');
	const blocks = payload?.blocks as { kind: string }[];
	assertExists(blocks);
	const sections = blocks.filter((b) => b.kind === 'section');
	assertEquals(sections.length, 1);
});

test('webhook: sync_success with schema has two section blocks', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(
		pcdSyncSuccess(makeSyncSuccessParams({ schemaUpdate: { from: 'v1.0', to: 'v1.1' } }))
	);

	const payload = captured[0]?.body as Record<string, unknown>;
	const blocks = payload?.blocks as { kind: string }[];
	const sections = blocks.filter((b) => b.kind === 'section');
	assertEquals(sections.length, 2);
});

test('webhook: sync_failed has empty blocks', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'pcd.sync_failed');
	const blocks = payload?.blocks as { kind: string }[];
	assertEquals(blocks.length, 0);
});

// =========================================================================
// Telegram
// =========================================================================

const MOCK_TOKEN = 'test-token-123';

test('telegram: updates_available has ℹ️ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(pcdUpdatesAvailable(makeUpdatesAvailableParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u2139\uFE0F'), true);
});

test('telegram: sync_success has ✅ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u2705'), true);
});

test('telegram: sync_failed has ❌ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u274C'), true);
});

test('telegram: omits section block content', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	// Commit messages are in a section block — should be omitted
	assertEquals(text.includes('add position to quality groups'), false);
});

// =========================================================================
// Real sends (skipped without .env)
// =========================================================================

test('real: sends updates_available to Discord', async () => {
	if (!REAL_DISCORD) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(pcdUpdatesAvailable(makeUpdatesAvailableParams()));
});

test('real: sends sync_success to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));
});

test('real: sends sync_success with schema to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(
		pcdSyncSuccess(makeSyncSuccessParams({ schemaUpdate: { from: 'v1.0', to: 'v1.1' } }))
	);
});

test('real: sends sync_failed to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));
});

test('real: sends updates_available to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(pcdUpdatesAvailable(makeUpdatesAvailableParams()));
});

test('real: sends sync_success to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));
});

test('real: sends sync_failed to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));
});

test('real: sends sync_success to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));
});

test('real: sends sync_failed to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));
});

test('real: sends updates_available to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(pcdUpdatesAvailable(makeUpdatesAvailableParams()));
});

test('real: sends sync_success to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(pcdSyncSuccess(makeSyncSuccessParams()));
});

test('real: sends sync_failed to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(pcdSyncFailed(makeSyncFailedParams()));
});

await run();
