/**
 * Arr drift notification - definition + Discord + Ntfy + Webhook + Telegram.
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
import { arrDriftDetected, arrDriftFailed } from '#notifications/definitions/arrDrift.ts';
import type {
	ArrDriftDetectedNotificationParams,
	ArrDriftFailedNotificationParams
} from '#notifications/definitions/arrDrift.ts';
import type { DriftDisplayEntity, DriftDisplayState } from '#shared/drift.ts';
import { notificationTypes } from '#shared/notifications/types.ts';

const MOCK_PORT = PORTS.notifications.arrDrift;
let captured: CapturedRequest[];
let mockServer: MockHttpServer;

let REAL_DISCORD: string | undefined;
let REAL_WEBHOOK_URL: string | undefined;
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
			if (key === 'TEST_WEBHOOK_URL') REAL_WEBHOOK_URL = value;
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

	expect(notification.type).toStrictEqual('arr.drift.detected');
	expect(notification.severity).toStrictEqual('warning');
	expect(notification.title).toStrictEqual('Drift Detected - Radarr (Movies)');
	expect(notification.message).toStrictEqual('');
});

test('failed type, severity, title, and first-line message', () => {
	const notification = arrDriftFailed(makeFailedParams());

	expect(notification.type).toStrictEqual('arr.drift.failed');
	expect(notification.severity).toStrictEqual('error');
	expect(notification.title).toStrictEqual('Drift Check Failed - Radarr (Movies)');
	expect(notification.message).toStrictEqual('Connection refused');
});

test('detected emits one section block per drift category', () => {
	const notification = arrDriftDetected(makeDetectedParams());
	const sections = notification.blocks?.filter((b) => b.kind === 'section') ?? [];

	const cf = sections.find((b) => b.kind === 'section' && b.title === 'Custom Format');
	expect(cf).not.toBeOneOf([null, undefined]);
	if (cf?.kind === 'section') {
		expect(cf.content).toStrictEqual('- Streaming Tier: 2 changes detected');
	}

	const qp = sections.find((b) => b.kind === 'section' && b.title === 'Quality Profile');
	expect(qp).not.toBeOneOf([null, undefined]);
	if (qp?.kind === 'section') {
		expect(qp.content).toStrictEqual('- HD Movies: 4 changes detected');
	}

	const dp = sections.find((b) => b.kind === 'section' && b.title === 'Delay Profile');
	expect(dp).not.toBeOneOf([null, undefined]);
	if (dp?.kind === 'section') {
		expect(dp.content).toStrictEqual('- Standard Delay: 1 change detected');
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
	expect(cf).not.toBeOneOf([null, undefined]);
	if (cf?.kind === 'section') {
		expect(cf.content.includes('Format 15')).toStrictEqual(true);
		expect(cf.content.includes('Format 16')).toStrictEqual(false);
		expect(cf.content.includes('Format 17')).toStrictEqual(false);
	}

	const more = sections.find((b) => b.kind === 'section' && b.title === 'More');
	expect(more).not.toBeOneOf([null, undefined]);
	if (more?.kind === 'section') {
		expect(more.content).toStrictEqual('+2 more');
	}
});

test('detected definition emits no field blocks', () => {
	const notification = arrDriftDetected(makeDetectedParams());
	const fields = notification.blocks?.filter((b) => b.kind === 'field') ?? [];
	expect(fields.length).toStrictEqual(0);
});

test('failed definition emits full Error section', () => {
	const notification = arrDriftFailed(makeFailedParams());
	const block = notification.blocks?.find((b) => b.kind === 'section' && b.title === 'Error');
	expect(block).not.toBeOneOf([null, undefined]);
	if (block?.kind === 'section') {
		expect(block.content).toStrictEqual('Connection refused\nfetch failed: ECONNREFUSED');
	}
});

test('shared notification metadata includes drift events', () => {
	const ids = notificationTypes.map((type) => type.id);
	expect(ids.includes('arr.drift.detected')).toStrictEqual(true);
	expect(ids.includes('arr.drift.failed')).toStrictEqual(true);
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
	expect(embed?.color).toStrictEqual(Colors.WARNING);
	const fields = (embed?.fields as { name: string; value: string }[]) ?? [];

	const cfField = fields.find((field) => field.name === 'Custom Format');
	expect(cfField).not.toBeOneOf([null, undefined]);
	expect(cfField!.value.includes('Streaming Tier')).toStrictEqual(true);

	const qpField = fields.find((field) => field.name === 'Quality Profile');
	expect(qpField).not.toBeOneOf([null, undefined]);
	expect(qpField!.value.includes('HD Movies')).toStrictEqual(true);

	const dpField = fields.find((field) => field.name === 'Delay Profile');
	expect(dpField).not.toBeOneOf([null, undefined]);
	expect(dpField!.value.includes('Standard Delay')).toStrictEqual(true);
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
	expect(embed?.color).toStrictEqual(Colors.ERROR);
	const fields = (embed?.fields as { name: string; value: string }[]) ?? [];
	const errorField = fields.find((field) => field.name === 'Error');
	expect(errorField).not.toBeOneOf([null, undefined]);
	expect(errorField!.value.includes('ECONNREFUSED')).toStrictEqual(true);
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
	expect(payload?.priority).toStrictEqual(4);
	expect(payload?.tags).toStrictEqual(['warning']);
	expect((payload?.message as string).includes('Streaming Tier')).toStrictEqual(false);
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
	expect(payload?.type).toStrictEqual('arr.drift.detected');
	expect(payload?.severity).toStrictEqual('warning');
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];

	const cfBlock = blocks.find(
		(block) => block.kind === 'section' && block.title === 'Custom Format'
	);
	expect(cfBlock).not.toBeOneOf([null, undefined]);
	expect(cfBlock!.content?.includes('Streaming Tier')).toStrictEqual(true);

	const qpBlock = blocks.find(
		(block) => block.kind === 'section' && block.title === 'Quality Profile'
	);
	expect(qpBlock).not.toBeOneOf([null, undefined]);
	expect(qpBlock!.content?.includes('HD Movies')).toStrictEqual(true);
});

test('webhook: failed sends full notification with error detail', async () => {
	captured.length = 0;
	const notifier = new WebhookNotifier({
		webhook_url: `http://localhost:${MOCK_PORT}/webhook`
	});
	await notifier.notify(arrDriftFailed(makeFailedParams()));

	const payload = captured[0]?.body as Record<string, unknown>;
	expect(payload?.type).toStrictEqual('arr.drift.failed');
	expect(payload?.severity).toStrictEqual('error');
	const blocks = payload?.blocks as { kind: string; title?: string; content?: string }[];
	const errorBlock = blocks.find((block) => block.kind === 'section' && block.title === 'Error');
	expect(errorBlock).not.toBeOneOf([null, undefined]);
	expect(errorBlock!.content?.includes('ECONNREFUSED')).toStrictEqual(true);
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
	expect(text.startsWith('\u26A0\uFE0F')).toStrictEqual(true);
	expect(text.includes('Streaming Tier')).toStrictEqual(false);
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
