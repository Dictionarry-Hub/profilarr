/**
 * Rename notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { rename } from '#notifications/definitions/rename.ts';
import type { RenameJobLog } from '#server/rename/types.ts';

const MOCK_PORT = PORTS.notifications.rename;
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

function makeRadarrLog(overrides: Partial<RenameJobLog> = {}): RenameJobLog {
	return {
		id: crypto.randomUUID(),
		instanceId: 1,
		instanceName: 'Movies',
		instanceType: 'radarr',
		startedAt: '2026-03-17T04:00:00.000Z',
		completedAt: '2026-03-17T04:02:00.000Z',
		status: 'success',
		config: { dryRun: false, renameFolders: true, ignoreTag: null, manual: false },
		library: { totalItems: 847, fetchDurationMs: 1500 },
		filtering: { afterIgnoreTag: 847, skippedByTag: 0 },
		results: {
			filesNeedingRename: 3,
			filesRenamed: 3,
			foldersRenamed: 1,
			commandsTriggered: 1,
			commandsCompleted: 1,
			commandsFailed: 0,
			errors: []
		},
		renamedItems: [
			{
				id: 101,
				title: 'Interstellar',
				folder: {
					existingPath: '/movies/Interstellar (2014) [imdb-tt0816692]',
					newPath: '/movies/Interstellar (2014) {imdb-tt0816692}'
				},
				files: [
					{
						existingPath: '/movies/Interstellar/Interstellar.2014.2160p.UHD.BluRay.Remux.mkv',
						newPath: '/movies/Interstellar/Interstellar (2014) Remux-2160p.mkv'
					}
				],
				imageUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
			},
			{
				id: 102,
				title: 'The Grand Budapest Hotel',
				files: [
					{
						existingPath:
							'/movies/The Grand Budapest Hotel/The.Grand.Budapest.Hotel.2014.1080p.BluRay.mkv',
						newPath:
							'/movies/The Grand Budapest Hotel/The Grand Budapest Hotel (2014) Bluray-1080p.mkv'
					}
				],
				imageUrl: 'https://image.tmdb.org/t/p/w1280/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg'
			}
		],
		...overrides
	};
}

function makeSonarrLog(overrides: Partial<RenameJobLog> = {}): RenameJobLog {
	return {
		id: crypto.randomUUID(),
		instanceId: 2,
		instanceName: 'TV Shows',
		instanceType: 'sonarr',
		startedAt: '2026-03-17T04:00:00.000Z',
		completedAt: '2026-03-17T04:03:00.000Z',
		status: 'success',
		config: { dryRun: false, renameFolders: false, ignoreTag: null, manual: true },
		library: { totalItems: 63, fetchDurationMs: 800 },
		filtering: { afterIgnoreTag: 63, skippedByTag: 0 },
		results: {
			filesNeedingRename: 4,
			filesRenamed: 4,
			foldersRenamed: 0,
			commandsTriggered: 1,
			commandsCompleted: 1,
			commandsFailed: 0,
			errors: []
		},
		renamedItems: [
			{
				id: 201,
				title: 'Breaking Bad',
				files: [
					{
						existingPath: '/tv/Breaking Bad/Season 3/S03E01.mkv',
						newPath: '/tv/Breaking Bad/Season 3/Breaking Bad - S03E01 - No Mas [Bluray-1080p].mkv'
					},
					{
						existingPath: '/tv/Breaking Bad/Season 3/S03E02.mkv',
						newPath:
							'/tv/Breaking Bad/Season 3/Breaking Bad - S03E02 - Caballo Sin Nombre [Bluray-1080p].mkv'
					},
					{
						existingPath: '/tv/Breaking Bad/Season 4/S04E01.mkv',
						newPath:
							'/tv/Breaking Bad/Season 4/Breaking Bad - S04E01 - Box Cutter [Bluray-1080p].mkv'
					},
					{
						existingPath: '/tv/Breaking Bad/Season 4/S04E02.mkv',
						newPath:
							'/tv/Breaking Bad/Season 4/Breaking Bad - S04E02 - Thirty-Eight Snub [Bluray-1080p].mkv'
					}
				],
				imageUrl: 'https://image.tmdb.org/t/p/w1280/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg'
			}
		],
		...overrides
	};
}

// =========================================================================
// Definition
// =========================================================================

test('type includes status', () => {
	expect(rename({ log: makeRadarrLog({ status: 'success' }) }).type).toStrictEqual(
		'rename.success'
	);
	expect(rename({ log: makeRadarrLog({ status: 'failed' }) }).type).toStrictEqual('rename.failed');
	expect(rename({ log: makeRadarrLog({ status: 'partial' }) }).type).toStrictEqual(
		'rename.partial'
	);
});

test('severity maps correctly', () => {
	expect(rename({ log: makeRadarrLog({ status: 'success' }) }).severity).toStrictEqual('success');
	expect(rename({ log: makeRadarrLog({ status: 'failed' }) }).severity).toStrictEqual('error');
	expect(rename({ log: makeRadarrLog({ status: 'partial' }) }).severity).toStrictEqual('warning');
});

test('title includes instance name', () => {
	expect(rename({ log: makeRadarrLog() }).title.includes('Movies')).toStrictEqual(true);
});

test('manual flag changes title', () => {
	const auto = rename({
		log: makeRadarrLog({
			config: { dryRun: false, renameFolders: false, ignoreTag: null, manual: false }
		})
	});
	const manual = rename({
		log: makeRadarrLog({
			config: { dryRun: false, renameFolders: false, ignoreTag: null, manual: true }
		})
	});
	expect(auto.title.includes('Automatic')).toStrictEqual(true);
	expect(manual.title.includes('Manual')).toStrictEqual(true);
});

test('stats section has file and folder counts', () => {
	const stats = rename({ log: makeRadarrLog() }).blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Stats'
	);
	expect(stats).not.toBeOneOf([null, undefined]);
	if (stats?.kind === 'section') {
		expect(stats.content.includes('3/3')).toStrictEqual(true);
		expect(stats.content.includes('Folders')).toStrictEqual(true);
	}
});

test('dry run shows in stats', () => {
	const log = makeRadarrLog({
		config: { dryRun: true, renameFolders: false, ignoreTag: null, manual: false }
	});
	const stats = rename({ log }).blocks?.find((b) => b.kind === 'section' && b.title === 'Stats');
	if (stats?.kind === 'section') expect(stats.content.includes('Dry Run')).toStrictEqual(true);
});

test('radarr rich mode has per-item sections with imageUrl', () => {
	const items = rename({ log: makeRadarrLog(), summaryNotifications: false }).blocks?.filter(
		(b) => b.kind === 'section' && b.title !== 'Stats'
	);
	expect(items!.length).toStrictEqual(2);
	for (const item of items!) {
		if (item.kind === 'section') expect(item.imageUrl).not.toBeOneOf([null, undefined]);
	}
});

test('radarr item content has before/after and folder rename', () => {
	const section = rename({ log: makeRadarrLog(), summaryNotifications: false }).blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Interstellar'
	);
	if (section?.kind === 'section') {
		expect(section.content.includes('Before')).toStrictEqual(true);
		expect(section.content.includes('After')).toStrictEqual(true);
		expect(section.content.includes('Folder')).toStrictEqual(true);
	}
});

test('summary mode has one sample with others count', () => {
	const items = rename({ log: makeRadarrLog(), summaryNotifications: true }).blocks?.filter(
		(b) => b.kind === 'section' && b.title !== 'Stats'
	);
	expect(items!.length).toStrictEqual(1);
	if (items![0].kind === 'section') {
		expect(items![0].title.includes('Interstellar')).toStrictEqual(true);
		expect(items![0].title.includes('1 other')).toStrictEqual(true);
	}
});

test('sonarr groups by season in content', () => {
	const section = rename({ log: makeSonarrLog(), summaryNotifications: false }).blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Breaking Bad'
	);
	if (section?.kind === 'section') {
		expect(section.content.includes('Season 3 (Before)')).toStrictEqual(true);
		expect(section.content.includes('Season 3 (After)')).toStrictEqual(true);
		expect(section.content.includes('Season 4 (Before)')).toStrictEqual(true);
		expect(section.content.includes('Season 4 (After)')).toStrictEqual(true);
	}
});

test('no items produces status-only message', () => {
	expect(
		rename({ log: makeRadarrLog({ renamedItems: [] }) }).message.includes(
			'No files needed renaming'
		)
	).toStrictEqual(true);
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
	await notifier.notify(rename({ log: makeRadarrLog() }));

	expect(getAllEmbeds()[0]?.color).toStrictEqual(Colors.SUCCESS);
});

test('discord: radarr item embeds have poster thumbnails', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeRadarrLog(), summaryNotifications: false }));

	const withThumbnails = getAllEmbeds().filter((e) => e.thumbnail);
	expect(withThumbnails.length).toStrictEqual(2);
});

test('discord: sonarr embed has poster thumbnail', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeSonarrLog(), summaryNotifications: false }));

	const withThumbnails = getAllEmbeds().filter((e) => e.thumbnail);
	expect(withThumbnails.length).toStrictEqual(1);
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
	await notifier.notify(rename({ log: makeRadarrLog() }));

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
	await notifier.notify(rename({ log: makeRadarrLog({ status: 'failed' }) }));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.priority).toStrictEqual(5);
	expect(payload?.tags).toStrictEqual(['x']);
});

test('ntfy: message includes instance name', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(rename({ log: makeRadarrLog() }));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect((payload?.title as string).includes('Movies')).toStrictEqual(true);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: sends full notification with blocks', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(rename({ log: makeRadarrLog() }));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('rename.success');
	expect(payload?.severity).toStrictEqual('success');
	const blocks = payload?.blocks as unknown[];
	expect(blocks).not.toBeOneOf([null, undefined]);
	expect(blocks.length > 0).toStrictEqual(true);
});

test('webhook: includes section blocks with imageUrl', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(rename({ log: makeRadarrLog(), summaryNotifications: false }));

	const payload = captured[0]?.body as Record<string, unknown>;
	const blocks = payload?.blocks as { kind: string; imageUrl?: string }[];
	const sections = blocks.filter((b) => b.kind === 'section' && b.imageUrl);
	expect(sections.length).toStrictEqual(2);
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
	await notifier.notify(rename({ log: makeRadarrLog() }));

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
	await notifier.notify(rename({ log: makeRadarrLog({ status: 'failed' }) }));

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
	await notifier.notify(rename({ log: makeRadarrLog({ status: 'partial' }) }));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	expect(text.startsWith('\u26A0\uFE0F')).toStrictEqual(true);
});

test('telegram: includes field block content but omits section blocks', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(rename({ log: makeRadarrLog(), summaryNotifications: false }));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	// Should not contain section content (movie titles, file paths)
	expect(text.includes('Interstellar.2014.2160p')).toStrictEqual(false);
});

// =========================================================================
// Real sends (skipped without .env)
// =========================================================================

test('real: sends radarr rename to Discord', async () => {
	if (!REAL_DISCORD) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeRadarrLog(), summaryNotifications: false }));
});

test('real: sends sonarr rename to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeSonarrLog(), summaryNotifications: false }));
});

test('real: sends rename to ntfy', async () => {
	if (!REAL_NTFY_URL || !REAL_NTFY_TOPIC) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new NtfyNotifier({
		server_url: REAL_NTFY_URL,
		topic: REAL_NTFY_TOPIC
	});
	await notifier.notify(rename({ log: makeRadarrLog() }));
});

test('real: sends rename to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(rename({ log: makeRadarrLog() }));
});

test('real: sends rename to Telegram', async () => {
	if (!REAL_TELEGRAM_TOKEN || !REAL_TELEGRAM_CHAT_ID) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new TelegramNotifier({
		bot_token: REAL_TELEGRAM_TOKEN,
		chat_id: REAL_TELEGRAM_CHAT_ID
	});
	await notifier.notify(rename({ log: makeRadarrLog() }));
});
