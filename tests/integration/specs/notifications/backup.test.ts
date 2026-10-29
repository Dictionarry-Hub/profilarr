/**
 * Backup notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { backupSuccess, backupFailed } from '#notifications/definitions/backup.ts';
import type { BackupSuccessParams, BackupFailedParams } from '#notifications/definitions/backup.ts';

const MOCK_PORT = PORTS.notifications.backup;
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
	expect(backupSuccess(makeSuccessParams()).type).toStrictEqual('backup.success');
});

test('success: severity is success', () => {
	expect(backupSuccess(makeSuccessParams()).severity).toStrictEqual('success');
});

test('success: title is Backup Created', () => {
	expect(backupSuccess(makeSuccessParams()).title).toStrictEqual('Backup Created');
});

test('success: message is filename', () => {
	const notification = backupSuccess(makeSuccessParams());
	expect(notification.message).toStrictEqual('backup-2026-04-17-120000.tar.gz');
});

test('success: size field uses MB with two decimals', () => {
	const notification = backupSuccess(makeSuccessParams());
	const sizeField = notification.blocks?.find((b) => b.kind === 'field' && b.label === 'Size');
	expect(sizeField).not.toBeOneOf([null, undefined]);
	if (sizeField?.kind === 'field') {
		expect(sizeField.value).toStrictEqual('12.00 MB');
	}
});

test('success: duration field included when provided', () => {
	const notification = backupSuccess(makeSuccessParams());
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	expect(durationField).not.toBeOneOf([null, undefined]);
	if (durationField?.kind === 'field') {
		expect(durationField.value).toStrictEqual('3.5s');
	}
});

test('success: duration field omitted when not provided', () => {
	const notification = backupSuccess(makeSuccessParams({ durationMs: undefined }));
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	expect(durationField).toStrictEqual(undefined);
});

test('success: duration formats ms under one second', () => {
	const notification = backupSuccess(makeSuccessParams({ durationMs: 250 }));
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	if (durationField?.kind === 'field') {
		expect(durationField.value).toStrictEqual('250ms');
	}
});

test('success: duration formats minutes and seconds for long backups', () => {
	const notification = backupSuccess(makeSuccessParams({ durationMs: 125_000 }));
	const durationField = notification.blocks?.find(
		(b) => b.kind === 'field' && b.label === 'Duration'
	);
	if (durationField?.kind === 'field') {
		expect(durationField.value).toStrictEqual('2m 5s');
	}
});

// =========================================================================
// Definition — failed
// =========================================================================

test('failed: type is backup.failed', () => {
	expect(backupFailed(makeFailedParams()).type).toStrictEqual('backup.failed');
});

test('failed: severity is error', () => {
	expect(backupFailed(makeFailedParams()).severity).toStrictEqual('error');
});

test('failed: title is Backup Failed', () => {
	expect(backupFailed(makeFailedParams()).title).toStrictEqual('Backup Failed');
});

test('failed: message is first line of error', () => {
	const notification = backupFailed(makeFailedParams({ error: 'tar failed\nSee log for details' }));
	expect(notification.message).toStrictEqual('tar failed');
});

test('failed: full error text in section block', () => {
	const notification = backupFailed(
		makeFailedParams({ error: 'tar failed\nstderr: permission denied' })
	);
	const errorBlock = notification.blocks?.find((b) => b.kind === 'section' && b.title === 'Error');
	expect(errorBlock).not.toBeOneOf([null, undefined]);
	if (errorBlock?.kind === 'section') {
		expect(errorBlock.content.includes('tar failed')).toStrictEqual(true);
		expect(errorBlock.content.includes('permission denied')).toStrictEqual(true);
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

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.SUCCESS);
});

test('discord: failed uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.ERROR);
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
	expect(allText.includes('backup-2026-04-17-120000.tar.gz')).toStrictEqual(true);
	expect(allText.includes('12.00 MB')).toStrictEqual(true);
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
	expect(description.startsWith('```\n')).toStrictEqual(true);
	expect(description.endsWith('\n```')).toStrictEqual(true);
	expect(description.includes('backup-2026-04-17-120000.tar.gz')).toStrictEqual(true);
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
	expect(description.startsWith('```')).toStrictEqual(false);
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
	expect(allText.includes('permission denied')).toStrictEqual(true);
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
	expect(payload?.priority).toStrictEqual(3);
	expect(payload?.tags).toStrictEqual(['white_check_mark']);
});

test('ntfy: failed maps to priority 5', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(5);
	expect(payload?.tags).toStrictEqual(['x']);
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
	expect(message.includes('backup-2026-04-17-120000.tar.gz')).toStrictEqual(true);
	expect(message.includes('```')).toStrictEqual(false);
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
	expect(payload?.type).toStrictEqual('backup.success');
	expect(payload?.severity).toStrictEqual('success');
	const blocks = payload?.blocks as { kind: string; label?: string; value?: string }[];
	expect(blocks).not.toBeOneOf([null, undefined]);
	const fields = blocks.filter((b) => b.kind === 'field');
	expect(fields.length).toStrictEqual(2);
	expect(fields.some((f) => f.label === 'Size')).toStrictEqual(true);
	expect(fields.some((f) => f.label === 'Duration')).toStrictEqual(true);
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
	expect(fields.length).toStrictEqual(1);
	expect(fields[0].label).toStrictEqual('Size');
});

test('webhook: failed has error section block', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(backupFailed(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('backup.failed');
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];
	const errorBlock = blocks.find((b) => b.kind === 'section' && b.title === 'Error');
	expect(errorBlock).not.toBeOneOf([null, undefined]);
	expect(errorBlock?.content?.includes('permission denied')).toStrictEqual(true);
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
	expect(text.startsWith('\u2705')).toStrictEqual(true);
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
	expect(text.startsWith('\u274C')).toStrictEqual(true);
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
	expect(text.includes('backup-2026-04-17-120000.tar.gz')).toStrictEqual(true);
	expect(text.includes('```')).toStrictEqual(false);
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
