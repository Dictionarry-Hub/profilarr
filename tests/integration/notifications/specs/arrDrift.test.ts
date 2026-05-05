/**
 * Arr drift notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { arrDriftDetected, arrDriftFailed } from '$notifications/definitions/arrDrift.ts';
import type {
	ArrDriftDetectedNotificationParams,
	ArrDriftFailedNotificationParams
} from '$notifications/definitions/arrDrift.ts';
import type { DriftDisplayEntity, DriftDisplayState } from '$shared/drift.ts';
import { notificationTypes } from '$shared/notifications/types.ts';

const MOCK_PORT = PORTS.notifications.arrDrift;
let captured: CapturedRequest[];
let mockServer: Deno.HttpServer;

let REAL_DISCORD: string | undefined;
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
			if (key === 'TEST_DISCORD_WEBHOOK') REAL_DISCORD = value;
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

function getAllEmbeds(): Record<string, unknown>[] {
	const embeds: Record<string, unknown>[] = [];
	for (const req of captured) {
		const body = req.body as { embeds?: Record<string, unknown>[] };
		if (body?.embeds) embeds.push(...body.embeds);
	}
	return embeds;
}

function makeEntity(
	section: 'custom_formats' | 'quality_profiles' | 'delay_profiles',
	sectionLabel: string,
	title: string,
	summary: string,
	state: DriftDisplayState = 'modified'
): DriftDisplayEntity {
	return {
		id: `${section}:${state}:${title}`,
		section,
		sectionLabel,
		title,
		state,
		stateLabel: state === 'missing' ? 'Missing' : 'Modified',
		tone: state === 'missing' ? 'danger' : 'warning',
		summary,
		changes: []
	};
}

function makeDetectedParams(
	overrides: Partial<ArrDriftDetectedNotificationParams> = {}
): ArrDriftDetectedNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		entities: [
			makeEntity('custom_formats', 'Custom Format', 'Streaming Tier', '2 changes detected'),
			makeEntity('quality_profiles', 'Quality Profile', 'HD Movies', '4 changes detected'),
			makeEntity('delay_profiles', 'Delay Profile', 'Standard Delay', '1 change detected')
		],
		...overrides
	};
}

function makeFailedParams(
	overrides: Partial<ArrDriftFailedNotificationParams> = {}
): ArrDriftFailedNotificationParams {
	return {
		instanceName: 'Movies',
		instanceType: 'radarr',
		error: 'Connection refused\nfetch failed: ECONNREFUSED',
		...overrides
	};
}

// =========================================================================
// Definition
// =========================================================================

test('detected type, severity, title, and empty message', () => {
	const notification = arrDriftDetected(makeDetectedParams());

	assertEquals(notification.type, 'arr.drift.detected');
	assertEquals(notification.severity, 'warning');
	assertEquals(notification.title, 'Drift Detected - Radarr (Movies)');
	assertEquals(notification.message, '');
});

test('failed type, severity, title, and first-line message', () => {
	const notification = arrDriftFailed(makeFailedParams());

	assertEquals(notification.type, 'arr.drift.failed');
	assertEquals(notification.severity, 'error');
	assertEquals(notification.title, 'Drift Check Failed - Radarr (Movies)');
	assertEquals(notification.message, 'Connection refused');
});

test('detected emits one section block per drift category', () => {
	const notification = arrDriftDetected(makeDetectedParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];

	const cf = sections.find((b) => b.kind === 'section' && b.title === 'Custom Format');
	assertExists(cf);
	if (cf?.kind === 'section') {
		assertEquals(cf.content, '- Streaming Tier: 2 changes detected');
	}

	const qp = sections.find((b) => b.kind === 'section' && b.title === 'Quality Profile');
	assertExists(qp);
	if (qp?.kind === 'section') {
		assertEquals(qp.content, '- HD Movies: 4 changes detected');
	}

	const dp = sections.find((b) => b.kind === 'section' && b.title === 'Delay Profile');
	assertExists(dp);
	if (dp?.kind === 'section') {
		assertEquals(dp.content, '- Standard Delay: 1 change detected');
	}
});

test('detected caps at 15 entities and emits a trailing More block', () => {
	const entities = Array.from({ length: 17 }, (_, index) =>
		makeEntity(
			'custom_formats',
			'Custom Format',
			`Format ${String(index + 1).padStart(2, '0')}`,
			'1 change detected'
		)
	);
	const notification = arrDriftDetected(makeDetectedParams({ entities }));
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];

	const cf = sections.find((b) => b.kind === 'section' && b.title === 'Custom Format');
	assertExists(cf);
	if (cf?.kind === 'section') {
		assertEquals(cf.content.includes('Format 15'), true);
		assertEquals(cf.content.includes('Format 16'), false);
		assertEquals(cf.content.includes('Format 17'), false);
	}

	const more = sections.find((b) => b.kind === 'section' && b.title === 'More');
	assertExists(more);
	if (more?.kind === 'section') {
		assertEquals(more.content, '+2 more');
	}
});

test('detected definition emits no field blocks', () => {
	const notification = arrDriftDetected(makeDetectedParams());
	const fields = notification.blocks?.filter((b) => b.kind === 'field') ?? [];
	assertEquals(fields.length, 0);
});

test('failed definition emits full Error section', () => {
	const notification = arrDriftFailed(makeFailedParams());
	const block = notification.blocks?.find((b) => b.kind === 'section' && b.title === 'Error');
	assertExists(block);
	if (block?.kind === 'section') {
		assertEquals(block.content, 'Connection refused\nfetch failed: ECONNREFUSED');
	}
});

test('shared notification metadata includes drift events', () => {
	const ids = notificationTypes.map((type) => type.id);
	assertEquals(ids.includes('arr.drift.detected'), true);
	assertEquals(ids.includes('arr.drift.failed'), true);
});

// =========================================================================
// Discord
// =========================================================================

test('discord: detected uses warning color and renders one field per category', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrDriftDetected(makeDetectedParams()));

	const embed = getAllEmbeds()[0];
	assertEquals(embed?.color, Colors.WARNING);
	const fields = (embed?.fields as { name: string; value: string }[]) ?? [];

	const cfField = fields.find((field) => field.name === 'Custom Format');
	assertExists(cfField);
	assertEquals(cfField!.value.includes('Streaming Tier'), true);

	const qpField = fields.find((field) => field.name === 'Quality Profile');
	assertExists(qpField);
	assertEquals(qpField!.value.includes('HD Movies'), true);

	const dpField = fields.find((field) => field.name === 'Delay Profile');
	assertExists(dpField);
	assertEquals(dpField!.value.includes('Standard Delay'), true);
});

test('discord: failed uses error color and renders error section', async () => {
	captured.length = 0;
	const notifier = new DiscordNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`,
		username: 'Profilarr',
		enable_mentions: false
	});
	await notifier.notify(arrDriftFailed(makeFailedParams()));

	const embed = getAllEmbeds()[0];
	assertEquals(embed?.color, Colors.ERROR);
	const fields = (embed?.fields as { name: string; value: string }[]) ?? [];
	const errorField = fields.find((field) => field.name === 'Error');
	assertExists(errorField);
	assertEquals(errorField!.value.includes('ECONNREFUSED'), true);
});

// =========================================================================
// Ntfy
// =========================================================================

test('ntfy: detected maps to priority 4 and omits entity names', async () => {
	captured.length = 0;
	const notifier = new NtfyNotifier({
		server_url: `http://localhost:${MOCK_PORT}`,
		topic: 'test-topic'
	});
	await notifier.notify(arrDriftDetected(makeDetectedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.priority, 4);
	assertEquals(payload?.tags, ['warning']);
	assertEquals((payload?.message as string).includes('Streaming Tier'), false);
});

// =========================================================================
// Webhook
// =========================================================================

test('webhook: detected sends full notification with one section per category', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrDriftDetected(makeDetectedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'arr.drift.detected');
	assertEquals(payload?.severity, 'warning');
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];

	const cfBlock = blocks.find(
		(block) => block.kind === 'section' && block.title === 'Custom Format'
	);
	assertExists(cfBlock);
	assertEquals(cfBlock!.content?.includes('Streaming Tier'), true);

	const qpBlock = blocks.find(
		(block) => block.kind === 'section' && block.title === 'Quality Profile'
	);
	assertExists(qpBlock);
	assertEquals(qpBlock!.content?.includes('HD Movies'), true);
});

test('webhook: failed sends full notification with error detail', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrDriftFailed(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	assertEquals(payload?.type, 'arr.drift.failed');
	assertEquals(payload?.severity, 'error');
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];
	const errorBlock = blocks.find((block) => block.kind === 'section' && block.title === 'Error');
	assertExists(errorBlock);
	assertEquals(errorBlock!.content?.includes('ECONNREFUSED'), true);
});

// =========================================================================
// Telegram
// =========================================================================

const MOCK_TOKEN = 'test-token-123';

test('telegram: detected has warning prefix and omits entity names', async () => {
	captured.length = 0;
	const notifier = new TelegramNotifier({
		bot_token: MOCK_TOKEN,
		chat_id: '123456',
		api_base_url: `http://localhost:${MOCK_PORT}`
	});
	await notifier.notify(arrDriftDetected(makeDetectedParams()));

	const text = (captured[0]?.body as Record<string, unknown>)?.text as string;
	assertEquals(text.startsWith('\u26A0\uFE0F'), true);
	assertEquals(text.includes('Streaming Tier'), false);
});

// =========================================================================
// Real sends (skipped without .env)
// =========================================================================

test('real: sends detected to Discord', async () => {
	if (!REAL_DISCORD) return;
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrDriftDetected(makeDetectedParams()));
});

test('real: sends detected with many entities to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});

	const entities: DriftDisplayEntity[] = [
		...Array.from({ length: 5 }, (_, i) =>
			makeEntity(
				'custom_formats',
				'Custom Format',
				`Custom Format ${i + 1}`,
				`${i + 1} change${i === 0 ? '' : 's'} detected`
			)
		),
		...Array.from({ length: 3 }, (_, i) =>
			makeEntity(
				'quality_profiles',
				'Quality Profile',
				`Quality Profile ${i + 1}`,
				`${i + 2} changes detected`
			)
		),
		makeEntity('delay_profiles', 'Delay Profile', 'Standard Delay', '1 change detected')
	];

	await notifier.notify(
		arrDriftDetected({
			instanceName: 'Movies',
			instanceType: 'radarr',
			entities
		})
	);
});

test('real: sends detected with +N more cap to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});

	const entities = Array.from({ length: 20 }, (_, i) =>
		makeEntity(
			'custom_formats',
			'Custom Format',
			`Format ${String(i + 1).padStart(2, '0')}`,
			'1 change detected'
		)
	);

	await notifier.notify(
		arrDriftDetected({
			instanceName: 'Movies',
			instanceType: 'radarr',
			entities
		})
	);
});

test('real: sends failed to Discord', async () => {
	if (!REAL_DISCORD) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new DiscordNotifier({
		webhook_url: REAL_DISCORD,
		username: 'Profilarr Test',
		enable_mentions: false
	});
	await notifier.notify(arrDriftFailed(makeFailedParams()));
});

test('real: sends detected to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(arrDriftDetected(makeDetectedParams()));
});

test('real: sends failed to webhook', async () => {
	if (!REAL_WEBHOOK_URL) return;
	await new Promise((r) => setTimeout(r, 2000));
	const notifier = new WebhookNotifier({
		webhook_url: REAL_WEBHOOK_URL
	});
	await notifier.notify(arrDriftFailed(makeFailedParams()));
});

await run();
