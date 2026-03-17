/**
 * Test notification - definition + Discord rendering + real webhook.
 */

import { assertEquals, assertExists } from '@std/assert';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { createMockServer, type CapturedRequest } from '../harness/mock-server.ts';
import { DiscordNotifier } from '$notifications/notifiers/discord/DiscordNotifier.ts';
import { Colors } from '$notifications/notifiers/discord/embed.ts';
import { test as testDef } from '$notifications/definitions/test.ts';

const MOCK_PORT = 7132;
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

function getEmbed() {
	return (captured[0]?.body as { embeds?: Record<string, unknown>[] })?.embeds?.[0];
}

// =========================================================================
// Definition
// =========================================================================

test('type is test', () => {
	assertEquals(testDef().type, 'test');
});

test('severity is info', () => {
	assertEquals(testDef().severity, 'info');
});

test('has title and message', () => {
	const n = testDef();
	assertExists(n.title);
	assertExists(n.message);
});

test('has no blocks', () => {
	assertEquals(testDef().blocks, undefined);
});

// =========================================================================
// Discord rendering
// =========================================================================

test('discord: renders single embed with info color', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(testDef());

	assertEquals(captured.length, 1);
	assertEquals(getEmbed()?.color, Colors.INFO);
	assertEquals(getEmbed()?.title, testDef().title);
	assertEquals(getEmbed()?.description, testDef().message);
});

// =========================================================================
// Real webhook (skipped without .env)
// =========================================================================

test('real: sends test notification', async () => {
	if (!REAL_WEBHOOK) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_WEBHOOK,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(testDef());
});

await run();
