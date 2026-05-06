/**
 * Announcement notification - definition + Discord + Ntfy + Webhook + Telegram.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { NtfyNotifier } from '$notifications/notifiers/ntfy/NtfyNotifier.ts';
import { WebhookNotifier } from '$notifications/notifiers/webhook/WebhookNotifier.ts';
import { TelegramNotifier } from '$notifications/notifiers/telegram/TelegramNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import { announcementNew } from '$notifications/definitions/announcement.ts';
import type { AnnouncementRecord } from '$announcements/profilarr/types.ts';

const MOCK_PORT = PORTS.notifications.announcement;
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
	assertEquals(announcementNew({ announcement: makeAnnouncement() }).type, 'announcement.new');
});

test('severity maps correctly', () => {
	assertEquals(
		announcementNew({ announcement: makeAnnouncement({ severity: 'info' }) }).severity,
		'info'
	);
	assertEquals(
		announcementNew({ announcement: makeAnnouncement({ severity: 'warning' }) }).severity,
		'warning'
	);
	assertEquals(
		announcementNew({ announcement: makeAnnouncement({ severity: 'critical' }) }).severity,
		'error'
	);
});

test('title matches the announcement title', () => {
	const title = 'API v2 coming soon';
	assertEquals(announcementNew({ announcement: makeAnnouncement({ title }) }).title, title);
});

test('message is a short plain summary (no body)', () => {
	const notification = announcementNew({ announcement: makeAnnouncement() });
	assertEquals(notification.message, 'A new announcement from the Profilarr team.');
	// Body is intentionally not in the notification message — users open the app to read it.
	assertEquals(notification.message.includes('legacy `/api/v0/sync` endpoint'), false);
});

test('blocks include severity and published_at field blocks', () => {
	const blocks = announcementNew({ announcement: makeAnnouncement() }).blocks ?? [];
	const severity = blocks.find((b) => b.kind === 'field' && b.label === 'Severity');
	const published = blocks.find((b) => b.kind === 'field' && b.label === 'Published');
	assertExists(severity);
	assertExists(published);
});

test('link block present when announcement.link is set', () => {
	const blocks = announcementNew({
		announcement: makeAnnouncement({ link: 'https://example.com/post' })
	}).blocks;
	const link = blocks?.find((b) => b.kind === 'field' && b.label === 'Link');
	assertExists(link);
	if (link?.kind === 'field') assertEquals(link.value, 'https://example.com/post');
});

test('link block absent when announcement.link is null', () => {
	const blocks = announcementNew({
		announcement: makeAnnouncement({ link: null })
	}).blocks;
	const link = blocks?.find((b) => b.kind === 'field' && b.label === 'Link');
	assertEquals(link, undefined);
});

// =========================================================================
// Source = pcd (per-database announcement)
// =========================================================================

test('pcd source: title is prefixed with the database name', () => {
	const out = announcementNew({
		announcement: makeAnnouncement({ title: 'Migration to v2' }),
		source: { kind: 'pcd', databaseName: 'Library DB' }
	});
	assertEquals(out.title, 'Library DB: Migration to v2');
});

test('pcd source: message names the database, not the Profilarr team', () => {
	const out = announcementNew({
		announcement: makeAnnouncement(),
		source: { kind: 'pcd', databaseName: 'Library DB' }
	});
	assertEquals(out.message, 'A new announcement from Library DB.');
});

test('pcd source: From block carries the database name', () => {
	const blocks =
		announcementNew({
			announcement: makeAnnouncement(),
			source: { kind: 'pcd', databaseName: 'Library DB' }
		}).blocks ?? [];
	const from = blocks.find((b) => b.kind === 'field' && b.label === 'From');
	assertExists(from);
	if (from?.kind === 'field') assertEquals(from.value, 'Library DB');
});

test('profilarr source: no From block (default behaviour preserved)', () => {
	const blocks =
		announcementNew({
			announcement: makeAnnouncement(),
			source: { kind: 'profilarr' }
		}).blocks ?? [];
	const from = blocks.find((b) => b.kind === 'field' && b.label === 'From');
	assertEquals(from, undefined);
});

test('omitting source defaults to profilarr (no From block, original message)', () => {
	const out = announcementNew({ announcement: makeAnnouncement() });
	assertEquals(out.message, 'A new announcement from the Profilarr team.');
	const from = (out.blocks ?? []).find((b) => b.kind === 'field' && b.label === 'From');
	assertEquals(from, undefined);
});

test('pcd source: severity mapping unchanged', () => {
	assertEquals(
		announcementNew({
			announcement: makeAnnouncement({ severity: 'critical' }),
			source: { kind: 'pcd', databaseName: 'Library DB' }
		}).severity,
		'error'
	);
});

test('pcd source: link block still appears when link is set', () => {
	const blocks =
		announcementNew({
			announcement: makeAnnouncement({ link: 'https://example.com/x' }),
			source: { kind: 'pcd', databaseName: 'Library DB' }
		}).blocks ?? [];
	const link = blocks.find((b) => b.kind === 'field' && b.label === 'Link');
	assertExists(link);
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
	assertEquals(embeds[0]?.color, Colors.INFO);
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
	assertEquals(embeds[0]?.color, Colors.ERROR);
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
	assertEquals(embeds[0]?.color, Colors.WARNING);
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
	assertEquals(embeds[0]?.title, 'Headline');
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
	assertEquals(payload?.priority, 3);
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
	assertEquals(payload?.priority, 4);
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
	assertEquals(payload?.priority, 5);
});

test('ntfy: title is the announcement title', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(announcementNew({ announcement: makeAnnouncement({ title: 'Headline' }) }));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.title, 'Headline');
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
	assertEquals(payload?.type, 'announcement.new');
	assertEquals(payload?.severity, 'info');
	const blocks = payload?.blocks as unknown[];
	assertExists(blocks);
	assertEquals(blocks.length > 0, true);
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
	assertEquals(link, undefined);
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
	assertEquals(text.startsWith('\u2139\uFE0F'), true);
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
	assertEquals(text.startsWith('\u26A0\uFE0F'), true);
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
	assertEquals(text.startsWith('\u274C'), true);
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

await run();
