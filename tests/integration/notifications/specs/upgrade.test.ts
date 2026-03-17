/**
 * Upgrade notification - definition + Discord rendering + real webhook.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import { upgrade } from '$notifications/definitions/upgrade.ts';
import type { UpgradeJobLog } from '$lib/server/upgrades/types.ts';

const MOCK_PORT = 7133;
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

function makeLog(overrides: Partial<UpgradeJobLog> = {}): UpgradeJobLog {
	return {
		id: crypto.randomUUID(),
		configId: 1,
		instanceId: 1,
		instanceName: 'Movies',
		startedAt: '2026-03-17T04:00:00.000Z',
		completedAt: '2026-03-17T04:05:00.000Z',
		status: 'success',
		config: {
			cron: '0 */6 * * *',
			filterMode: 'sequential',
			selectedFilter: 'quality-upgrade',
			dryRun: false
		},
		library: { totalItems: 847, fetchedFromCache: false, fetchDurationMs: 2100 },
		filter: {
			id: 'f-quality',
			name: 'Quality Upgrade',
			rules: { type: 'group', match: 'all', children: [] },
			matchedCount: 312,
			afterCooldown: 198,
			dryRunExcluded: 0
		},
		selection: {
			method: 'random',
			requestedCount: 5,
			actualCount: 3,
			items: [
				{
					id: 101,
					title: 'Interstellar',
					original: {
						type: 'movie',
						fileName: 'Interstellar.2014.1080p.BluRay.x264-SPARKS.mkv',
						formats: ['Bluray', 'x264', '1080p'],
						score: 72
					},
					upgrades: [
						{
							release: 'Interstellar.2014.2160p.UHD.BluRay.Remux.HDR.HEVC.Atmos-EPSiLON.mkv',
							formats: ['Remux', 'x265', '2160p', 'HDR', 'Atmos'],
							score: 145
						}
					],
					imageUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
				},
				{
					id: 102,
					title: 'The Grand Budapest Hotel',
					original: {
						type: 'movie',
						fileName: 'The.Grand.Budapest.Hotel.2014.720p.BluRay.x264-SPARKS.mkv',
						formats: ['Bluray', 'x264', '720p'],
						score: 48
					},
					upgrades: [
						{
							release:
								'The.Grand.Budapest.Hotel.2014.1080p.BluRay.Remux.AVC.DTS-HD.MA.5.1-RARBG.mkv',
							formats: ['Remux', 'AVC', '1080p', 'DTS-HD MA'],
							score: 112
						}
					],
					imageUrl: 'https://image.tmdb.org/t/p/w1280/eWdyYQreja6JGCzqHWXpWHDrrPo.jpg'
				},
				{
					id: 103,
					title: 'Mad Max: Fury Road',
					original: {
						type: 'movie',
						fileName: 'Mad.Max.Fury.Road.2015.2160p.UHD.BluRay.Remux.mkv',
						formats: ['Remux', 'x265', '2160p'],
						score: 130
					},
					upgrades: [],
					imageUrl: 'https://image.tmdb.org/t/p/w1280/hA2ple9q4qnwxp3hKVNhroipsir.jpg'
				}
			]
		},
		results: { searchesTriggered: 5, successful: 2, failed: 0, errors: [] },
		...overrides
	};
}

function makeSonarrLog(overrides: Partial<UpgradeJobLog> = {}): UpgradeJobLog {
	return {
		id: crypto.randomUUID(),
		configId: 2,
		instanceId: 2,
		instanceName: 'TV Shows',
		startedAt: '2026-03-17T04:00:00.000Z',
		completedAt: '2026-03-17T04:05:00.000Z',
		status: 'success',
		config: {
			cron: '0 */6 * * *',
			filterMode: 'sequential',
			selectedFilter: 'quality-upgrade',
			dryRun: false
		},
		library: { totalItems: 63, fetchedFromCache: false, fetchDurationMs: 800 },
		filter: {
			id: 'f-quality',
			name: 'Quality Upgrade',
			rules: { type: 'group', match: 'all', children: [] },
			matchedCount: 28,
			afterCooldown: 15,
			dryRunExcluded: 0
		},
		selection: {
			method: 'random',
			requestedCount: 3,
			actualCount: 2,
			items: [
				{
					id: 201,
					title: 'Breaking Bad',
					original: {
						type: 'series',
						title: 'Breaking Bad',
						episodes: [
							{
								seasonNumber: 3,
								fileName: 'S03E01 - No Mas.mkv',
								formats: ['Bluray', 'x264'],
								score: 72
							},
							{
								seasonNumber: 3,
								fileName: 'S03E02 - Caballo Sin Nombre.mkv',
								formats: ['Bluray', 'x264'],
								score: 72
							},
							{
								seasonNumber: 4,
								fileName: 'S04E01 - Box Cutter.mkv',
								formats: ['Bluray', 'x264'],
								score: 72
							}
						]
					},
					upgrades: [
						{
							release: 'Breaking.Bad.S03.1080p.BluRay.Remux.AVC.DTS-HD.MA.5.1-EPSiLON.mkv',
							formats: ['Remux', 'AVC', '1080p', 'DTS-HD MA'],
							score: 120,
							seasonNumber: 3
						},
						{
							release: 'Breaking.Bad.S04.1080p.BluRay.Remux.AVC.DTS-HD.MA.5.1-EPSiLON.mkv',
							formats: ['Remux', 'AVC', '1080p', 'DTS-HD MA'],
							score: 120,
							seasonNumber: 4
						}
					],
					imageUrl: 'https://image.tmdb.org/t/p/w1280/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg'
				},
				{
					id: 202,
					title: 'Better Call Saul',
					original: {
						type: 'series',
						title: 'Better Call Saul',
						episodes: [
							{
								seasonNumber: 1,
								fileName: 'S01E01 - Uno.mkv',
								formats: ['WEB-DL', 'x264'],
								score: 55
							}
						]
					},
					upgrades: [],
					imageUrl: 'https://image.tmdb.org/t/p/w1280/fC2HDm5t0kHl7mTm7jxMR31b7by.jpg'
				}
			]
		},
		results: { searchesTriggered: 2, successful: 1, failed: 0, errors: [] },
		...overrides
	};
}

// =========================================================================
// Definition
// =========================================================================

test('type includes status', () => {
	assertEquals(upgrade({ log: makeLog({ status: 'success' }) }).type, 'upgrade.success');
	assertEquals(upgrade({ log: makeLog({ status: 'failed' }) }).type, 'upgrade.failed');
	assertEquals(upgrade({ log: makeLog({ status: 'partial' }) }).type, 'upgrade.partial');
	assertEquals(upgrade({ log: makeLog({ status: 'skipped' }) }).type, 'upgrade.skipped');
});

test('severity maps correctly', () => {
	assertEquals(upgrade({ log: makeLog({ status: 'success' }) }).severity, 'success');
	assertEquals(upgrade({ log: makeLog({ status: 'failed' }) }).severity, 'error');
	assertEquals(upgrade({ log: makeLog({ status: 'partial' }) }).severity, 'warning');
	assertEquals(upgrade({ log: makeLog({ status: 'skipped' }) }).severity, 'info');
});

test('title includes instance name', () => {
	assertEquals(upgrade({ log: makeLog() }).title.includes('Movies'), true);
});

test('manual flag changes title', () => {
	assertEquals(upgrade({ log: makeLog(), manual: false }).title.includes('Automatic'), true);
	assertEquals(upgrade({ log: makeLog(), manual: true }).title.includes('Manual'), true);
});

test('message includes upgrade count', () => {
	assertEquals(upgrade({ log: makeLog() }).message.includes('2 upgrade'), true);
});

test('stats section has filter, selector, upgrades, funnel', () => {
	const n = upgrade({ log: makeLog() });
	const stats = n.blocks?.find((b) => b.kind === 'section' && b.title === 'Stats');
	assertExists(stats);
	if (stats?.kind === 'section') {
		assertEquals(stats.content.includes('Quality Upgrade'), true);
		assertEquals(stats.content.includes('Random'), true);
		assertEquals(stats.content.includes('2/3'), true);
		assertEquals(stats.content.includes('847 library'), true);
	}
});

test('dry run shows in stats', () => {
	const log = makeLog({ config: { cron: '', filterMode: '', selectedFilter: '', dryRun: true } });
	const stats = upgrade({ log }).blocks?.find((b) => b.kind === 'section' && b.title === 'Stats');
	if (stats?.kind === 'section') {
		assertEquals(stats.content.includes('Dry Run'), true);
	}
});

test('only items with upgrades get sections', () => {
	const items = upgrade({ log: makeLog() }).blocks?.filter(
		(b) => b.kind === 'section' && b.title !== 'Stats'
	);
	assertEquals(items!.length, 2);
});

test('item sections have imageUrl', () => {
	const items = upgrade({ log: makeLog() }).blocks?.filter(
		(b) => b.kind === 'section' && b.title !== 'Stats'
	);
	for (const item of items!) {
		if (item.kind === 'section') assertExists(item.imageUrl);
	}
});

test('item content has release, scores, and formats', () => {
	const n = upgrade({ log: makeLog() });
	const section = n.blocks?.find((b) => b.kind === 'section' && b.title === 'Interstellar');
	if (section?.kind === 'section') {
		assertEquals(section.content.includes('Interstellar.2014.2160p'), true);
		assertEquals(section.content.includes('Current: 72'), true);
		assertEquals(section.content.includes('Upgrade: 145'), true);
		assertEquals(section.content.includes('Bluray'), true);
		assertEquals(section.content.includes('Remux'), true);
	}
});

test('no items produces stats-only notification', () => {
	const log = makeLog({
		selection: { method: 'random', requestedCount: 5, actualCount: 0, items: [] }
	});
	assertEquals(upgrade({ log }).message.includes('No items to search'), true);
});

test('errors appear as field block', () => {
	const log = makeLog({
		status: 'partial',
		results: { searchesTriggered: 5, successful: 2, failed: 1, errors: ['Failed: timeout'] }
	});
	const err = upgrade({ log }).blocks?.find((b) => b.kind === 'field' && b.label === 'Errors');
	assertExists(err);
});

// --- Sonarr ---

test('sonarr: flattens series into per-season sections', () => {
	const n = upgrade({ log: makeSonarrLog() });
	const items = n.blocks?.filter((b) => b.kind === 'section' && b.title !== 'Stats');
	// Breaking Bad has S03 and S04 upgrades, flattened to 2 sections. Better Call Saul has no upgrades.
	assertEquals(items!.length, 2);
	const titles = items!.map((b) => (b as { title: string }).title);
	assertEquals(titles.includes('Breaking Bad - Season 3'), true);
	assertEquals(titles.includes('Breaking Bad - Season 4'), true);
});

test('sonarr: season sections carry imageUrl from parent series', () => {
	const n = upgrade({ log: makeSonarrLog() });
	const items = n.blocks?.filter((b) => b.kind === 'section' && b.title !== 'Stats');
	for (const item of items!) {
		if (item.kind === 'section') {
			assertExists(item.imageUrl);
			assertEquals(item.imageUrl!.includes('tmdb.org'), true);
		}
	}
});

test('sonarr: season content includes episode count and score', () => {
	const n = upgrade({ log: makeSonarrLog() });
	const s3 = n.blocks?.find((b) => b.kind === 'section' && b.title === 'Breaking Bad - Season 3');
	assertExists(s3);
	if (s3?.kind === 'section') {
		assertEquals(s3.content.includes('120'), true);
		assertEquals(s3.content.includes('Remux'), true);
	}
});

// =========================================================================
// Discord rendering
// =========================================================================

test('discord: summary embed has success color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(upgrade({ log: makeLog() }));

	const embeds = getAllEmbeds();
	assertEquals(embeds[0]?.color, Colors.SUCCESS);
});

test('discord: item embeds have poster thumbnails', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(upgrade({ log: makeLog() }));

	const embeds = getAllEmbeds();
	const withThumbnails = embeds.filter((e) => e.thumbnail);
	assertEquals(withThumbnails.length, 2);
});

test('discord: item embeds have titles matching movie names', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(upgrade({ log: makeLog() }));

	const embeds = getAllEmbeds();
	const titles = embeds.map((e) => e.title).filter(Boolean);
	assertEquals(titles.includes('Interstellar'), true);
	assertEquals(titles.includes('The Grand Budapest Hotel'), true);
});

test('discord: failed status uses error color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(upgrade({ log: makeLog({ status: 'failed' }) }));

	assertEquals(getAllEmbeds()[0]?.color, Colors.ERROR);
});

// =========================================================================
// Real webhook (skipped without .env)
// =========================================================================

test('real: sends radarr upgrade notification', async () => {
	if (!REAL_WEBHOOK) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_WEBHOOK,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(upgrade({ log: makeLog() }));
});

test('real: sends sonarr upgrade notification', async () => {
	if (!REAL_WEBHOOK) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_WEBHOOK,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(upgrade({ log: makeSonarrLog() }));
});

await run();
