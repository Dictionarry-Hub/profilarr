/**
 * Tests for the per-database announcement authoring helpers (FS-only).
 * Verifies write / delete / round-trip with the parser.
 */

import { BaseTest } from '../../base/BaseTest.ts';
import { assertEquals, assertExists } from '@std/assert';
import {
	deleteAnnouncement,
	generateAnnouncementId,
	writeAnnouncement,
	type AnnouncementFileInput
} from '$announcements/database/authoring.ts';
import { parseAnnouncementsDir } from '$announcements/database/parser.ts';

function baseInput(): AnnouncementFileInput {
	return {
		title: 'Migration to v2',
		severity: 'warning',
		publishedAt: '2026-04-20T10:00:00Z',
		expiresAt: '2026-05-20T10:00:00Z',
		link: 'https://example.com/migration',
		body: '# Heading\n\nBody content.\n'
	};
}

class DatabaseAnnouncementsAuthoringTest extends BaseTest {
	runTests(): void {
		// ─── generateAnnouncementId ──────────────────────────────────────────

		this.test('generateAnnouncementId returns a 26-char ULID', () => {
			const id = generateAnnouncementId();
			assertEquals(id.length, 26);
			// Crockford Base32: digits + uppercase letters minus I, L, O, U
			assertEquals(/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id), true);
		});

		this.test('generateAnnouncementId returns unique values', () => {
			const a = generateAnnouncementId();
			const b = generateAnnouncementId();
			assertEquals(a === b, false);
		});

		// ─── writeAnnouncement ───────────────────────────────────────────────

		this.test('writeAnnouncement creates the announcements/ directory if missing', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const stat = await Deno.stat(`${ctx.tempDir}/announcements`);
			assertEquals(stat.isDirectory, true);

			const fileStat = await Deno.stat(`${ctx.tempDir}/announcements/${id}.md`);
			assertEquals(fileStat.isFile, true);
		});

		this.test('writeAnnouncement leaves no temp file behind after success', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const entries: string[] = [];
			for await (const entry of Deno.readDir(`${ctx.tempDir}/announcements`)) {
				entries.push(entry.name);
			}
			assertEquals(entries, [`${id}.md`]);
		});

		this.test('writeAnnouncement overwrites an existing file in place', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());
			await writeAnnouncement(ctx.tempDir, id, { ...baseInput(), title: 'Updated title' });

			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed.length, 1);
			assertEquals(result.parsed[0].title, 'Updated title');
		});

		// ─── round-trip with parser ──────────────────────────────────────────

		this.test('write then parse yields the same data', async (ctx) => {
			const id = generateAnnouncementId();
			const input = baseInput();
			await writeAnnouncement(ctx.tempDir, id, input);

			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(result.parsed.length, 1);
			const parsed = result.parsed[0];
			assertEquals(parsed.id, id);
			assertEquals(parsed.title, input.title);
			assertEquals(parsed.severity, input.severity);
			assertEquals(parsed.published_at, input.publishedAt);
			assertEquals(parsed.expires_at, input.expiresAt);
			assertEquals(parsed.link, input.link);
			assertEquals(parsed.body, input.body);
		});

		this.test('round-trip preserves null optional fields', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, {
				...baseInput(),
				expiresAt: null,
				link: null
			});

			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(result.parsed[0].expires_at, null);
			assertEquals(result.parsed[0].link, null);
		});

		this.test('round-trip preserves an empty body', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, { ...baseInput(), body: '' });

			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(result.parsed[0].body, '');
		});

		this.test(
			'round-trip handles bodies with quotes / colons / yaml-looking lines',
			async (ctx) => {
				const id = generateAnnouncementId();
				const tricky = '"hello": world\n---\nfoo: bar\n';
				await writeAnnouncement(ctx.tempDir, id, { ...baseInput(), body: tricky });

				const result = await parseAnnouncementsDir(ctx.tempDir);
				assertEquals(result.errors, []);
				assertEquals(result.parsed[0].body, tricky);
			}
		);

		// ─── deleteAnnouncement ─────────────────────────────────────────────

		this.test('deleteAnnouncement removes an existing file and returns true', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const removed = await deleteAnnouncement(ctx.tempDir, id);
			assertEquals(removed, true);

			await this.assertFileNotExists(`${ctx.tempDir}/announcements/${id}.md`);
		});

		this.test('deleteAnnouncement returns false when the file is missing', async (ctx) => {
			const id = generateAnnouncementId();
			const removed = await deleteAnnouncement(ctx.tempDir, id);
			assertEquals(removed, false);
		});

		this.test('deleteAnnouncement does not affect siblings', async (ctx) => {
			const a = generateAnnouncementId();
			const b = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, a, baseInput());
			await writeAnnouncement(ctx.tempDir, b, baseInput());

			await deleteAnnouncement(ctx.tempDir, a);

			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed.length, 1);
			assertEquals(result.parsed[0].id, b);
		});

		// ─── id derivation ───────────────────────────────────────────────────

		this.test('writeAnnouncement uses the id as the filename', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const stat = await Deno.stat(`${ctx.tempDir}/announcements/${id}.md`);
			assertExists(stat);
		});
	}
}

const suite = new DatabaseAnnouncementsAuthoringTest();
suite.runTests();
