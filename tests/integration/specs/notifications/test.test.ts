/**
 * Test notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { test as testDef } from '#notifications/definitions/test.ts';

const MOCK_PORT = PORTS.notifications.test;
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

// =========================================================================
// Definition
// =========================================================================

test('type is test', () => {
	expect(testDef().type).toStrictEqual('test');
});

test('severity is info', () => {
	expect(testDef().severity).toStrictEqual('info');
});

test('has title and message', () => {
	const n = testDef();
	expect(n.title).not.toBeOneOf([null, undefined]);
	expect(n.message).not.toBeOneOf([null, undefined]);
});

test('has no blocks', () => {
	expect(testDef().blocks).toStrictEqual(undefined);
});

// =========================================================================
// Discord
// =========================================================================

test('discord: renders single embed with info color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(testDef());

	expect(captured.length).toStrictEqual(1);
	const embed = (captured[0]?.body as { embeds?: Record<string, unknown>[] })?.embeds?.[0];
	expect(embed?.color).toStrictEqual(Colors.INFO);
	expect(embed?.title).toStrictEqual(testDef().title);
	expect(embed?.description).toStrictEqual(testDef().message);
});

// =========================================================================
// Ntfy
// =========================================================================

test('ntfy: sends title and message', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(testDef());

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.title).toStrictEqual('Test Notification');
	expect((payload?.message as string).includes('test notification from Profilarr')).toStrictEqual(
		true
	);
});

test('ntfy: info severity maps to priority 3 and information_source tag', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(testDef());

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(3);
	expect(payload?.tags).toStrictEqual(['information_source']);
});

test('ntfy: POSTs to server root with topic in payload', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(testDef());

	expect(captured[0]?.method).toStrictEqual('POST');
	expect(captured[0]?.path).toStrictEqual('/');
	expect((captured[0]?.body as Record<string, unknown>)?.topic).toStrictEqual('test-topic');
});

test('ntfy: sends Authorization header when access_token configured', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic',
		access_token: 'tk_abc123'
	});
	await notifier.notify(testDef());

	expect(captured[0]?.headers['authorization']).toStrictEqual('Bearer tk_abc123');
});

test('ntfy: no Authorization header when access_token absent', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(testDef());

	expect(captured[0]?.headers['authorization']).toStrictEqual(undefined);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: sends raw Notification as JSON', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(testDef());

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('test');
	expect(payload?.severity).toStrictEqual('info');
	expect(payload?.title).toStrictEqual('Test Notification');
	expect(payload?.blocks).toStrictEqual(undefined);
});

test('webhook: POSTs with application/json content-type', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(testDef());

	expect(captured[0]?.method).toStrictEqual('POST');
	expect(captured[0]?.headers['content-type']).toStrictEqual('application/json');
});

test('webhook: sends Authorization header when auth_header configured', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		auth_header: 'Bearer my-secret-token'
	});
	await notifier.notify(testDef());

	expect(captured[0]?.headers['authorization']).toStrictEqual('Bearer my-secret-token');
});

test('webhook: no Authorization header when auth_header absent', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(testDef());

	expect(captured[0]?.headers['authorization']).toStrictEqual(undefined);
});

// =========================================================================
// Telegram
// =========================================================================

const MOCK_TOKEN = 'test-token-123';

test('telegram: POSTs to /bot{token}/sendMessage', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(testDef());

	expect(captured.length).toStrictEqual(1);
	expect(captured[0]?.method).toStrictEqual('POST');
	expect(captured[0]?.path).toStrictEqual(`/bot${MOCK_TOKEN}/sendMessage`);
});

test('telegram: payload has chat_id, text, and parse_mode HTML', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(testDef());

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.chat_id).toStrictEqual('123456');
	expect(payload?.parse_mode).toStrictEqual('HTML');
	expect(typeof payload?.text).toStrictEqual('string');
});

test('telegram: info severity has emoji prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(testDef());

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u2139\uFE0F')).toStrictEqual(true);
});

test('telegram: renders title in bold HTML', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(testDef());

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.includes(`<b>${testDef().title}</b>`)).toStrictEqual(true);
});

// =========================================================================
// Real sends (skipped without .env)
// =========================================================================

test('real: sends test notification to Discord', async () => {
	if (!REAL_DISCORD) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(testDef());
});

test('real: sends test notification to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(testDef());
});

test('real: sends test notification to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(testDef());
});

test('real: sends test notification to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(testDef());
});
