/**
 * Rename notification - definition + Discord rendering + real webhook.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import { rename } from '$notifications/definitions/rename.ts';
import type { RenameJobLog } from '$lib/server/rename/types.ts';

const MOCK_PORT = 7134;
let captured: CapturedRequest[];
let mockServer: Deno.HttpServer;

let REAL_WEBHOOK: string | undefined;
try {
	const envPath = new URL('../.env', import.meta.url).pathname;
	const content = await Deno.readTextFile(envPath);
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIdx = trimmed.indexOf('=');
		if (eqIdx > 0 && trimmed.slice(0, eqIdx) === 'TEST_DISCORD_WEBHOOK') {
			REAL_WEBHOOK = trimmed.slice(eqIdx + 1);
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
	assertEquals(rename({ log: makeRadarrLog({ status: 'success' }) }).type, 'rename.success');
	assertEquals(rename({ log: makeRadarrLog({ status: 'failed' }) }).type, 'rename.failed');
	assertEquals(rename({ log: makeRadarrLog({ status: 'partial' }) }).type, 'rename.partial');
});

test('severity maps correctly', () => {
	assertEquals(rename({ log: makeRadarrLog({ status: 'success' }) }).severity, 'success');
	assertEquals(rename({ log: makeRadarrLog({ status: 'failed' }) }).severity, 'error');
	assertEquals(rename({ log: makeRadarrLog({ status: 'partial' }) }).severity, 'warning');
});

test('title includes instance name', () => {
	assertEquals(rename({ log: makeRadarrLog() }).title.includes('Movies'), true);
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
	assertEquals(auto.title.includes('Automatic'), true);
	assertEquals(manual.title.includes('Manual'), true);
});

test('stats section has file and folder counts', () => {
	const stats = rename({ log: makeRadarrLog() }).blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Stats'
	);
	assertExists(stats);
	if (stats?.kind === 'section') {
		assertEquals(stats.content.includes('3/3'), true);
		assertEquals(stats.content.includes('Folders'), true);
	}
});

test('dry run shows in stats', () => {
	const log = makeRadarrLog({
		config: { dryRun: true, renameFolders: false, ignoreTag: null, manual: false }
	});
	const stats = rename({ log }).blocks?.find((b) => b.kind === 'section' && b.title === 'Stats');
	if (stats?.kind === 'section') assertEquals(stats.content.includes('Dry Run'), true);
});

test('radarr rich mode has per-item sections with imageUrl', () => {
	const items = rename({ log: makeRadarrLog(), summaryNotifications: false }).blocks?.filter(
		(b) => b.kind === 'section' && b.title !== 'Stats'
	);
	assertEquals(items!.length, 2);
	for (const item of items!) {
		if (item.kind === 'section') assertExists(item.imageUrl);
	}
});

test('radarr item content has before/after and folder rename', () => {
	const section = rename({ log: makeRadarrLog(), summaryNotifications: false }).blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Interstellar'
	);
	if (section?.kind === 'section') {
		assertEquals(section.content.includes('Before'), true);
		assertEquals(section.content.includes('After'), true);
		assertEquals(section.content.includes('Folder'), true);
	}
});

test('summary mode has one sample with others count', () => {
	const items = rename({ log: makeRadarrLog(), summaryNotifications: true }).blocks?.filter(
		(b) => b.kind === 'section' && b.title !== 'Stats'
	);
	assertEquals(items!.length, 1);
	if (items![0].kind === 'section') {
		assertEquals(items![0].title.includes('Interstellar'), true);
		assertEquals(items![0].title.includes('1 other'), true);
	}
});

test('sonarr groups by season in content', () => {
	const section = rename({ log: makeSonarrLog(), summaryNotifications: false }).blocks?.find(
		(b) => b.kind === 'section' && b.title === 'Breaking Bad'
	);
	if (section?.kind === 'section') {
		assertEquals(section.content.includes('Season 3 (Before)'), true);
		assertEquals(section.content.includes('Season 3 (After)'), true);
		assertEquals(section.content.includes('Season 4 (Before)'), true);
		assertEquals(section.content.includes('Season 4 (After)'), true);
	}
});

test('no items produces status-only message', () => {
	assertEquals(
		rename({ log: makeRadarrLog({ renamedItems: [] }) }).message.includes(
			'No files needed renaming'
		),
		true
	);
});

// =========================================================================
// Discord rendering
// =========================================================================

test('discord: radarr item embeds have poster thumbnails', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeRadarrLog(), summaryNotifications: false }));

	const withThumbnails = getAllEmbeds().filter((e) => e.thumbnail);
	assertEquals(withThumbnails.length, 2);
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
	assertEquals(withThumbnails.length, 1);
});

test('discord: success uses correct color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeRadarrLog() }));

	assertEquals(getAllEmbeds()[0]?.color, Colors.SUCCESS);
});

// =========================================================================
// Real webhook (skipped without .env)
// =========================================================================

test('real: sends radarr rename notification', async () => {
	if (!REAL_WEBHOOK) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_WEBHOOK,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeRadarrLog(), summaryNotifications: false }));
});

test('real: sends sonarr rename notification', async () => {
	if (!REAL_WEBHOOK) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_WEBHOOK,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(rename({ log: makeSonarrLog(), summaryNotifications: false }));
});

await run();
