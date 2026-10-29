/**
 * Announcement notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { announcementNew } from '#notifications/definitions/announcement.ts';
import type { AnnouncementRecord } from '#server/announcements/profilarr/types.ts';

const MOCK_PORT = PORTS.notifications.announcement;
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
// Test data
// =========================================================================

function makeAnnouncement(overrides: Partial<AnnouncementRecord> = {}): AnnouncementRecord {
	return {
		id: '01HX00000000000000000000AA',
		title: 'Sync endpoint moving to v2 in Profilarr 2.5',
		severity: 'info',
		publishedAt: '2026-04-15T10:00:00.000Z',
		expiresAt: null,
		minVersion: '2.0.0',
		maxVersion: null,
		link: 'https://github.com/Dictionarry-Hub/profilarr/discussions/999',
		body: 'The legacy `/api/v0/sync` endpoint will be removed in 2.5. Update your scripts to `/api/v1/*`.',
		withdrawn: false,
		readAt: null,
		fetchedAt: '2026-04-15T10:30:00.000Z',
		bodyFetchedAt: '2026-04-15T10:31:00.000Z',
		...overrides
	};
}

// =========================================================================
// Definition
// =========================================================================

test('type is announcement.new', () => {
	expect(announcementNew({ announcement: makeAnnouncement() }).type).toStrictEqual(
		'announcement.new'
	);
});

test('severity maps correctly', () => {
	expect(
		announcementNew({ announcement: makeAnnouncement({ severity: 'info' }) }).severity
	).toStrictEqual('info');
	expect(
		announcementNew({ announcement: makeAnnouncement({ severity: 'warning' }) }).severity
	).toStrictEqual('warning');
	expect(
		announcementNew({ announcement: makeAnnouncement({ severity: 'critical' }) }).severity
	).toStrictEqual('error');
});

test('title matches the announcement title', () => {
	const title = 'API v2 coming soon';
	expect(announcementNew({ announcement: makeAnnouncement({ title }) }).title).toStrictEqual(title);
});

test('message is a short plain summary (no body)', () => {
	const notification = announcementNew({ announcement: makeAnnouncement() });
	expect(notification.message).toStrictEqual('A new announcement from the Profilarr team.');
	// Body is intentionally not in the notification message — users open the app to read it.
	expect(notification.message.includes('legacy `/api/v0/sync` endpoint')).toStrictEqual(false);
});

test('blocks include severity and published_at field blocks', () => {
	const blocks = announcementNew({ announcement: makeAnnouncement() }).blocks ?? [];
	const severity = blocks.find((b) => b.kind === 'field' && b.label === 'Severity');
	const published = blocks.find((b) => b.kind === 'field' && b.label === 'Published');
	expect(severity).not.toBeOneOf([null, undefined]);
	expect(published).not.toBeOneOf([null, undefined]);
});

test('link block present when announcement.link is set', () => {
	const blocks = announcementNew({
		announcement: makeAnnouncement({ link: 'https://example.com/post' })
	}).blocks;
	const link = blocks?.find((b) => b.kind === 'field' && b.label === 'Link');
	expect(link).not.toBeOneOf([null, undefined]);
	if (link?.kind === 'field') expect(link.value).toStrictEqual('https://example.com/post');
});

test('link block absent when announcement.link is null', () => {
	const blocks = announcementNew({
		announcement: makeAnnouncement({ link: null })
	}).blocks;
	const link = blocks?.find((b) => b.kind === 'field' && b.label === 'Link');
	expect(link).toStrictEqual(undefined);
});

// =========================================================================
// Source = pcd (per-database announcement)
// =========================================================================

test('pcd source: title is prefixed with the database name', () => {
	const out = announcementNew({
		announcement: makeAnnouncement({ title: 'Migration to v2' }),
		source: { kind: 'pcd', databaseName: 'Library DB' }
	});
	expect(out.title).toStrictEqual('Library DB: Migration to v2');
});

test('pcd source: message names the database, not the Profilarr team', () => {
	const out = announcementNew({
		announcement: makeAnnouncement(),
		source: { kind: 'pcd', databaseName: 'Library DB' }
	});
	expect(out.message).toStrictEqual('A new announcement from Library DB.');
});

test('pcd source: From block carries the database name', () => {
	const blocks =
		announcementNew({
			announcement: makeAnnouncement(),
			source: { kind: 'pcd', databaseName: 'Library DB' }
		}).blocks ?? [];
	const from = blocks.find((b) => b.kind === 'field' && b.label === 'From');
	expect(from).not.toBeOneOf([null, undefined]);
	if (from?.kind === 'field') expect(from.value).toStrictEqual('Library DB');
});

test('profilarr source: no From block (default behaviour preserved)', () => {
	const blocks =
		announcementNew({
			announcement: makeAnnouncement(),
			source: { kind: 'profilarr' }
		}).blocks ?? [];
	const from = blocks.find((b) => b.kind === 'field' && b.label === 'From');
	expect(from).toStrictEqual(undefined);
});

test('omitting source defaults to profilarr (no From block, original message)', () => {
	const out = announcementNew({ announcement: makeAnnouncement() });
	expect(out.message).toStrictEqual('A new announcement from the Profilarr team.');
	const from = (out.blocks ?? []).find((b) => b.kind === 'field' && b.label === 'From');
	expect(from).toStrictEqual(undefined);
});

test('pcd source: severity mapping unchanged', () => {
	expect(
		announcementNew({
			announcement: makeAnnouncement({ severity: 'critical' }),
			source: { kind: 'pcd', databaseName: 'Library DB' }
		}).severity
	).toStrictEqual('error');
});

test('pcd source: link block still appears when link is set', () => {
	const blocks =
		announcementNew({
			announcement: makeAnnouncement({ link: 'https://example.com/x' }),
			source: { kind: 'pcd', databaseName: 'Library DB' }
		}).blocks ?? [];
	const link = blocks.find((b) => b.kind === 'field' && b.label === 'Link');
	expect(link).not.toBeOneOf([null, undefined]);
});

// =========================================================================
// Discord
// =========================================================================

test('discord: info severity uses Colors.INFO', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ severity: 'info' }) }));

	const embeds = (captured[0]?.body as { embeds?: Record<string, unknown>[] })?.embeds ?? [];
	expect(embeds[0]?.color).toStrictEqual(Colors.INFO);
});

test('discord: critical severity uses Colors.ERROR', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(
		announcementNew({ announcement: makeAnnouncement({ severity: 'critical' }) })
	);

	const embeds = (captured[0]?.body as { embeds?: Record<string, unknown>[] })?.embeds ?? [];
	expect(embeds[0]?.color).toStrictEqual(Colors.ERROR);
});

test('discord: warning severity uses Colors.WARNING', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(
		announcementNew({ announcement: makeAnnouncement({ severity: 'warning' }) })
	);

	const embeds = (captured[0]?.body as { embeds?: Record<string, unknown>[] })?.embeds ?? [];
	expect(embeds[0]?.color).toStrictEqual(Colors.WARNING);
});

test('discord: embed title matches announcement title', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ title: 'Headline' }) }));

	const embeds = (captured[0]?.body as { embeds?: Record<string, unknown>[] })?.embeds ?? [];
	expect(embeds[0]?.title).toStrictEqual('Headline');
});

// =========================================================================
// Ntfy
// =========================================================================

test('ntfy: info severity maps to priority 3', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ severity: 'info' }) }));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(3);
});

test('ntfy: warning severity maps to priority 4', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(
		announcementNew({ announcement: makeAnnouncement({ severity: 'warning' }) })
	);

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(4);
});

test('ntfy: critical severity maps to priority 5', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(
		announcementNew({ announcement: makeAnnouncement({ severity: 'critical' }) })
	);

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(5);
});

test('ntfy: title is the announcement title', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ title: 'Headline' }) }));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.title).toStrictEqual('Headline');
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: sends raw notification with all blocks', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement() }));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('announcement.new');
	expect(payload?.severity).toStrictEqual('info');
	const blocks = payload?.blocks as unknown[];
	expect(blocks).not.toBeOneOf([null, undefined]);
	expect(blocks.length > 0).toStrictEqual(true);
});

test('webhook: omits link block when link is null', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ link: null }) }));

	const payload = captured[0]?.body as Record<string, unknown>;
	const blocks = (payload?.blocks as { kind: string; label?: string }[]) ?? [];
	const link = blocks.find((b) => b.kind === 'field' && b.label === 'Link');
	expect(link).toStrictEqual(undefined);
});

// =========================================================================
// Telegram
// =========================================================================

const MOCK_TOKEN = 'test-token-123';

test('telegram: info severity has ℹ️ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ severity: 'info' }) }));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u2139\uFE0F')).toStrictEqual(true);
});

test('telegram: warning severity has ⚠️ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(
		announcementNew({ announcement: makeAnnouncement({ severity: 'warning' }) })
	);

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u26A0\uFE0F')).toStrictEqual(true);
});

test('telegram: critical severity has ❌ prefix', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(
		announcementNew({ announcement: makeAnnouncement({ severity: 'critical' }) })
	);

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u274C')).toStrictEqual(true);
});

// =========================================================================
// Real sends (skipped without .env)
// =========================================================================

test('real: sends info announcement to Discord', async () => {
	if (!REAL_DISCORD) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement() }));
});

test('real: sends critical announcement to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(
		announcementNew({
			announcement: makeAnnouncement({
				severity: 'critical',
				title: 'Urgent: security fix available',
				link: 'https://github.com/Dictionarry-Hub/profilarr/security'
			})
		})
	);
});

test('real: sends announcement to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement() }));
});

test('real: sends announcement to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({ webhook_url: REAL_WEBHOOK_URL });
	await notifier.notify(announcementNew({ announcement: makeAnnouncement() }));
});

test('real: sends announcement to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement() }));
});
