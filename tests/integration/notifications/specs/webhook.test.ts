/**
 * Webhook notification - passthrough tier + auth + real webhook.
 * Passthrough tier: entire Notification object sent as-is (all blocks included).
 */

import { assertEquals } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { WebhookNotifier } from '$notifications/notifiers/webhook/WebhookNotifier.ts';
import { upgrade } from '$notifications/definitions/upgrade.ts';
import { rename } from '$notifications/definitions/rename.ts';
import type { Notification } from '$notifications/types.ts';
import type { UpgradeJobLog } from '$lib/server/upgrades/types.ts';
import type { RenameJobLog } from '$lib/server/rename/types.ts';

const MOCK_PORT = 7136;
let captured: CapturedRequest[];
let mockServer: Deno.HttpServer;

let REAL_WEBHOOK_URL: string | undefined;
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
			if (key === 'TEST_WEBHOOK_URL') REAL_WEBHOOK_URL = value;
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

function getPayload(): Record<string, unknown> {
	return captured[0]?.body as Record<string, unknown>;
}

function getHeaders(): Record<string, string> {
	return captured[0]?.headers ?? {};
}

function makeNotifier(authHeader?: string): WebhookNotifier {
	return new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		...(authHeader ? { auth_header: authHeader } : {})
	});
}

function simpleNotification(
	severity: Notification['severity'],
	blocks?: Notification['blocks']
): Notification {
	return {
		type: 'test',
		severity,
		title: 'Test Title',
		message: 'Test message body',
		blocks
	};
}

// =========================================================================
// Payload structure (passthrough)
// =========================================================================

test('sends notification type in payload', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('info'));
	assertEquals(getPayload()?.type, 'test');
});

test('sends severity in payload', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('error'));
	assertEquals(getPayload()?.severity, 'error');
});

test('sends title in payload', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('info'));
	assertEquals(getPayload()?.title, 'Test Title');
});

test('sends message in payload', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('info'));
	assertEquals(getPayload()?.message, 'Test message body');
});

test('includes field blocks in payload', async () => {
	captured.length = 0;
	const blocks: Notification['blocks'] = [
		{ kind: 'field', label: 'Files', value: '5/5', inline: true },
		{ kind: 'field', label: 'Mode', value: 'Live', inline: true }
	];
	await makeNotifier().notify(simpleNotification('info', blocks));
	const payload = getPayload();
	const payloadBlocks = payload?.blocks as Notification['blocks'];
	assertEquals(payloadBlocks?.length, 2);
	assertEquals(payloadBlocks?.[0], { kind: 'field', label: 'Files', value: '5/5', inline: true });
	assertEquals(payloadBlocks?.[1], { kind: 'field', label: 'Mode', value: 'Live', inline: true });
});

test('includes section blocks in payload (unlike summary tier)', async () => {
	captured.length = 0;
	const blocks: Notification['blocks'] = [
		{ kind: 'field', label: 'Count', value: '3' },
		{
			kind: 'section',
			title: 'Interstellar',
			content: 'Release\nInterstellar.2014.2160p.mkv'
		},
		{
			kind: 'section',
			title: 'Grand Budapest',
			content: 'Release\nGrand.Budapest.2014.1080p.mkv'
		}
	];
	await makeNotifier().notify(simpleNotification('info', blocks));
	const payload = getPayload();
	const payloadBlocks = payload?.blocks as Notification['blocks'];
	assertEquals(payloadBlocks?.length, 3);
	assertEquals(payloadBlocks?.[1]?.kind, 'section');
	assertEquals((payloadBlocks?.[1] as { title: string }).title, 'Interstellar');
	assertEquals(payloadBlocks?.[2]?.kind, 'section');
	assertEquals((payloadBlocks?.[2] as { title: string }).title, 'Grand Budapest');
});

test('sends no blocks key when notification has no blocks', async () => {
	captured.length = 0;
	await makeNotifier().notify({
		type: 'test',
		severity: 'info',
		title: 'No blocks',
		message: 'Simple notification'
	});
	const payload = getPayload();
	assertEquals(payload?.blocks, undefined);
});

// =========================================================================
// HTTP behavior
// =========================================================================

test('POSTs to the configured webhook URL path', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('info'));
	assertEquals(captured[0]?.method, 'POST');
	assertEquals(captured[0]?.path, '/webhook');
});

test('sets Content-Type to application/json', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('info'));
	assertEquals(getHeaders()['content-type'], 'application/json');
});

// =========================================================================
// Auth header
// =========================================================================

test('sends Authorization header when auth_header configured', async () => {
	captured.length = 0;
	await makeNotifier('Bearer my-secret-token').notify(simpleNotification('info'));
	assertEquals(getHeaders()['authorization'], 'Bearer my-secret-token');
});

test('sends no Authorization header when auth_header absent', async () => {
	captured.length = 0;
	await makeNotifier().notify(simpleNotification('info'));
	assertEquals(getHeaders()['authorization'], undefined);
});

// =========================================================================
// Real webhook (skipped without .env)
// =========================================================================

function makeUpgradeLog(): UpgradeJobLog {
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
				}
			]
		},
		results: { searchesTriggered: 5, successful: 2, failed: 0, errors: [] }
	};
}

function makeRenameLog(): RenameJobLog {
	return {
		id: crypto.randomUUID(),
		instanceId: 1,
		instanceName: 'Movies',
		instanceType: 'radarr',
		startedAt: '2026-03-17T04:00:00.000Z',
		completedAt: '2026-03-17T04:01:00.000Z',
		status: 'success',
		config: { dryRun: false, renameFolders: true, ignoreTag: null, manual: false },
		library: { totalItems: 500, fetchDurationMs: 800 },
		filtering: { afterIgnoreTag: 500, skippedByTag: 0 },
		results: {
			filesNeedingRename: 3,
			filesRenamed: 3,
			foldersRenamed: 1,
			commandsTriggered: 3,
			commandsCompleted: 3,
			commandsFailed: 0,
			errors: []
		},
		renamedItems: [
			{
				id: 1,
				title: 'Interstellar',
				folder: {
					existingPath: '/movies/Interstellar (2014)',
					newPath: '/movies/Interstellar (2014) {imdb-tt0816692}'
				},
				files: [
					{
						existingPath: '/movies/Interstellar (2014)/Interstellar.2014.1080p.BluRay.mkv',
						newPath: '/movies/Interstellar (2014)/Interstellar (2014) [Bluray-1080p].mkv'
					}
				],
				imageUrl: 'https://image.tmdb.org/t/p/w500/gEU2QniE6E77NI6lCU6MxlNBvIx.jpg'
			}
		]
	};
}

test('real: sends upgrade notification to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	const notifier = new WebhookNotifier({ webhook_url: REAL_WEBHOOK_URL });
	await notifier.notify(upgrade({ log: makeUpgradeLog() }));
});

test('real: sends rename notification to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({ webhook_url: REAL_WEBHOOK_URL });
	await notifier.notify(rename({ log: makeRenameLog() }));
});

await run();
