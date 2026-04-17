/**
 * Backup notification - definition + Discord + Ntfy + Webhook + Telegram.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { NtfyNotifier } from '$notifications/notifiers/ntfy/NtfyNotifier.ts';
import { WebhookNotifier } from '$notifications/notifiers/webhook/WebhookNotifier.ts';
import { TelegramNotifier } from '$notifications/notifiers/telegram/TelegramNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import { backupSuccess, backupFailed } from '$notifications/definitions/backup.ts';
import type { BackupSuccessParams, BackupFailedParams } from '$notifications/definitions/backup.ts';

const MOCK_PORT = 7139;
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

function makeSuccessParams(overrides: Partial<BackupSuccessParams> = {}): BackupSuccessParams {
	return {
		filename: 'backup-2026-04-17-120000.tar.gz',
		sizeBytes: 12_582_912, // 12 MiB
		durationMs: 3500,
		...overrides
	};
}

function makeFailedParams(overrides: Partial<BackupFailedParams> = {}): BackupFailedParams {
	return {
		error: 'tar command failed with code 1: permission denied',
		...overrides
	};
}

// =========================================================================
// Definition — success
// =========================================================================

test('success: type is backup.success', () => {
	assertEquals(backupSuccess(makeSuccessParams()).type, 'backup.success');
});

test('success: severity is success', () => {
	assertEquals(backupSuccess(makeSuccessParams()).severity, 'success');
});

test('success: title is Backup Created', () => {
	assertEquals(backupSuccess(makeSuccessParams()).title, 'Backup Created');
});

test('success: message is filename', () => {
	const notification = backupSuccess(makeSuccessParams());
	assertEquals(notification.message, 'backup-2026-04-17-120000.tar.gz');
});

test('success: size field uses MB with two decimals', () => {
	const notification = backupSuccess(makeSuccessParams());
	const sizeField = notification.blocks?.find((b) => b.kind === 'field' && b.label === 'Size');
	assertExists(sizeField);
	if (sizeField?.kind === 'field') {
		assertEquals(sizeField.value, '12.00 MB');
	}
});

test('success: duration field included when provided', () => {
	const notification = backupSuccess(makeSuccessParams());
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	assertExists(durationField);
	if (durationField?.kind === 'field') {
		assertEquals(durationField.value, '3.5s');
	}
});

test('success: duration field omitted when not provided', () => {
	const notification = backupSuccess(makeSuccessParams({ durationMs: undefined }));
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	assertEquals(durationField, undefined);
});

test('success: duration formats ms under one second', () => {
	const notification = backupSuccess(makeSuccessParams({ durationMs: 250 }));
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	if (durationField?.kind === 'field') {
		assertEquals(durationField.value, '250ms');
	}
});

test('success: duration formats minutes and seconds for long backups', () => {
	const notification = backupSuccess(makeSuccessParams({ durationMs: 125_000 }));
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	if (durationField?.kind === 'field') {
		assertEquals(durationField.value, '2m 5s');
	}
});

// =========================================================================
// Definition — failed
// =========================================================================

test('failed: type is backup.failed', () => {
	assertEquals(backupFailed(makeFailedParams()).type, 'backup.failed');
});

test('failed: severity is error', () => {
	assertEquals(backupFailed(makeFailedParams()).severity, 'error');
});

test('failed: title is Backup Failed', () => {
	assertEquals(backupFailed(makeFailedParams()).title, 'Backup Failed');
});

test('failed: message is first line of error', () => {
	const notification = backupFailed(makeFailedParams({ error: 'tar failed\nSee log for details' }));
	assertEquals(notification.message, 'tar failed');
});

test('failed: full error text in section block', () => {
	const notification = backupFailed(
		makeFailedParams({ error: 'tar failed\nstderr: permission denied' })
	);
	const errorBlock = notification.blocks?.find((b) => b.kind === 'section' && b.title === 'Error');
	assertExists(errorBlock);
	if (errorBlock?.kind === 'section') {
		assertEquals(errorBlock.content.includes('tar failed'), true);
		assertEquals(errorBlock.content.includes('permission denied'), true);
	}
});

// =========================================================================
// Discord
// =========================================================================

test('discord: success uses success color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.SUCCESS);
});

test('discord: failed uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	assertEquals(getAllEmbeds()[0]?.color, Colors.ERROR);
});

test('discord: success embed includes filename and size', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);
	const descriptions = embeds.map((e) => e.description as string).filter(Boolean);

	const allText = [...allFields.map((f) => `${f.name} ${f.value}`), ...descriptions].join(' ');
	assertEquals(allText.includes('backup-2026-04-17-120000.tar.gz'), true);
	assertEquals(allText.includes('12.00 MB'), true);
});

test('discord: success wraps filename description in a code block', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));

	const description = getAllEmbeds()[0]?.description as string;
	assertEquals(description.startsWith('```\n'), true);
	assertEquals(description.endsWith('\n```'), true);
	assertEquals(description.includes('backup-2026-04-17-120000.tar.gz'), true);
});

test('discord: failed description is plain (no code block)', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	const description = getAllEmbeds()[0]?.description as string;
	assertEquals(description.startsWith('```'), false);
});

test('discord: failed embed includes error text', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	const embeds = getAllEmbeds();
	const allFields = embeds.flatMap((e) => (e.fields as { name: string; value: string }[]) ?? []);
	const descriptions = embeds.map((e) => e.description as string).filter(Boolean);

	const allText = [...allFields.map((f) => `${f.name} ${f.value}`), ...descriptions].join(' ');
	assertEquals(allText.includes('permission denied'), true);
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
	await notifier.notify(backupSuccess(makeSuccessParams()));

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
	await notifier.notify(backupFailed(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 5);
	assertEquals(payload?.tags, ['x']);
});

test('ntfy: success message includes filename as plain text (no code fences)', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	const message = payload?.message as string;
	assertEquals(message.includes('backup-2026-04-17-120000.tar.gz'), true);
	assertEquals(message.includes('```'), false);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: success sends full notification with field blocks', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'backup.success');
	assertEquals(payload?.severity, 'success');
	const blocks = payload?.blocks as { kind: string; label?: string; value?: string }[];
	assertExists(blocks);
	const fields = blocks.filter((b) => b.kind === 'field');
	assertEquals(fields.length, 2);
	assertEquals(
		fields.some((f) => f.label === 'Size'),
		true
	);
	assertEquals(
		fields.some((f) => f.label === 'Duration'),
		true
	);
});

test('webhook: success without duration has single field block', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(backupSuccess(makeSuccessParams({ durationMs: undefined })));

	const payload = captured[0]?.body as Record<string, unknown>;
	const blocks = payload?.blocks as { kind: string; label?: string }[];
	const fields = blocks.filter((b) => b.kind === 'field');
	assertEquals(fields.length, 1);
	assertEquals(fields[0].label, 'Size');
});

test('webhook: failed has error section block', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'backup.failed');
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];
	const errorBlock = blocks.find((b) => b.kind === 'section' && b.title === 'Error');
	assertExists(errorBlock);
	assertEquals(errorBlock?.content?.includes('permission denied'), true);
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
	await notifier.notify(backupSuccess(makeSuccessParams()));

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
	await notifier.notify(backupFailed(makeFailedParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u274C'), true);
});

test('telegram: success includes filename as plain text (no code fences)', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.includes('backup-2026-04-17-120000.tar.gz'), true);
	assertEquals(text.includes('```'), false);
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
	await notifier.notify(backupSuccess(makeSuccessParams()));
});

test('real: sends failed to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(backupFailed(makeFailedParams()));
});

test('real: sends success to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));
});

test('real: sends failed to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(backupFailed(makeFailedParams()));
});

test('real: sends success to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));
});

test('real: sends failed to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(backupFailed(makeFailedParams()));
});

test('real: sends success to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(backupSuccess(makeSuccessParams()));
});

test('real: sends failed to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(backupFailed(makeFailedParams()));
});

await run();
