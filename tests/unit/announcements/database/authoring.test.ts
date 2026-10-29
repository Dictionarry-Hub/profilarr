/**
 * Tests for the per-database announcement authoring helpers (FS-only).
 * Verifies write / delete / round-trip with the parser.
 */

import { readFile, readdir, stat } from 'node:fs/promises';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { expect } from 'vitest';
import {
	deleteAnnouncement,
	generateAnnouncementId,
	writeAnnouncement,
	type AnnouncementFileInput
} from '#server/announcements/database/authoring.ts';
import { parseAnnouncementsDir } from '#server/announcements/database/parser.ts';

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
			expect(id.length).toStrictEqual(26);
			// Crockford Base32: digits + uppercase letters minus I, L, O, U
			expect(/^[0-9A-HJKMNP-TV-Z]{26}$/.test(id)).toStrictEqual(true);
		});

		this.test('generateAnnouncementId returns unique values', () => {
			const a = generateAnnouncementId();
			const b = generateAnnouncementId();
			expect(a === b).toStrictEqual(false);
		});

		// ─── writeAnnouncement ───────────────────────────────────────────────

		this.test('writeAnnouncement creates the announcements/ directory if missing', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const dirStat = await stat(`${ctx.tempDir}/announcements`);
			expect(dirStat.isDirectory()).toStrictEqual(true);

			const fileStat = await stat(`${ctx.tempDir}/announcements/${id}.md`);
			expect(fileStat.isFile()).toStrictEqual(true);
		});

		this.test('writeAnnouncement leaves no temp file behind after success', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const entries: string[] = [];
			for (const name of await readdir(`${ctx.tempDir}/announcements`)) {
				entries.push(name);
			}
			expect(entries).toStrictEqual([`${id}.md`]);
		});

		this.test('writeAnnouncement overwrites an existing file in place', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());
			await writeAnnouncement(ctx.tempDir, id, { ...baseInput(), title: 'Updated title' });

			const result = await parseAnnouncementsDir(ctx.tempDir);
			expect(result.parsed.length).toStrictEqual(1);
			expect(result.parsed[0].title).toStrictEqual('Updated title');
		});

		this.test('writeAnnouncement writes the expected file', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const content = await readFile(`${ctx.tempDir}/announcements/${id}.md`, 'utf8');
			expect(content).toStrictEqual(`---
title: Migration to v2
severity: warning
published_at: '2026-04-20T10:00:00Z'
expires_at: '2026-05-20T10:00:00Z'
link: https://example.com/migration
---

# Heading

Body content.
`);
		});

		this.test('writeAnnouncement quotes titles that would read as another type', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, {
				...baseInput(),
				title: '2026-04-20',
				expiresAt: null,
				link: null,
				body: ''
			});

			const content = await readFile(`${ctx.tempDir}/announcements/${id}.md`, 'utf8');
			expect(content).toStrictEqual(`---
title: '2026-04-20'
severity: warning
published_at: '2026-04-20T10:00:00Z'
---
`);
		});

		// ─── round-trip with parser ──────────────────────────────────────────

		this.test('write then parse yields the same data', async (ctx) => {
			const id = generateAnnouncementId();
			const input = baseInput();
			await writeAnnouncement(ctx.tempDir, id, input);

			const result = await parseAnnouncementsDir(ctx.tempDir);
			expect(result.errors).toStrictEqual([]);
			expect(result.parsed.length).toStrictEqual(1);
			const parsed = result.parsed[0];
			expect(parsed.id).toStrictEqual(id);
			expect(parsed.title).toStrictEqual(input.title);
			expect(parsed.severity).toStrictEqual(input.severity);
			expect(parsed.published_at).toStrictEqual(input.publishedAt);
			expect(parsed.expires_at).toStrictEqual(input.expiresAt);
			expect(parsed.link).toStrictEqual(input.link);
			expect(parsed.body).toStrictEqual(input.body);
		});

		this.test('round-trip preserves null optional fields', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, {
				...baseInput(),
				expiresAt: null,
				link: null
			});

			const result = await parseAnnouncementsDir(ctx.tempDir);
			expect(result.errors).toStrictEqual([]);
			expect(result.parsed[0].expires_at).toStrictEqual(null);
			expect(result.parsed[0].link).toStrictEqual(null);
		});

		this.test('round-trip preserves an empty body', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, { ...baseInput(), body: '' });

			const result = await parseAnnouncementsDir(ctx.tempDir);
			expect(result.errors).toStrictEqual([]);
			expect(result.parsed[0].body).toStrictEqual('');
		});

		this.test(
			'round-trip handles bodies with quotes / colons / yaml-looking lines',
			async (ctx) => {
				const id = generateAnnouncementId();
				const tricky = '"hello": world\n---\nfoo: bar\n';
				await writeAnnouncement(ctx.tempDir, id, { ...baseInput(), body: tricky });

				const result = await parseAnnouncementsDir(ctx.tempDir);
				expect(result.errors).toStrictEqual([]);
				expect(result.parsed[0].body).toStrictEqual(tricky);
			}
		);

		// ─── deleteAnnouncement ─────────────────────────────────────────────

		this.test('deleteAnnouncement removes an existing file and returns true', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const removed = await deleteAnnouncement(ctx.tempDir, id);
			expect(removed).toStrictEqual(true);

			await this.assertFileNotExists(`${ctx.tempDir}/announcements/${id}.md`);
		});

		this.test('deleteAnnouncement returns false when the file is missing', async (ctx) => {
			const id = generateAnnouncementId();
			const removed = await deleteAnnouncement(ctx.tempDir, id);
			expect(removed).toStrictEqual(false);
		});

		this.test('deleteAnnouncement does not affect siblings', async (ctx) => {
			const a = generateAnnouncementId();
			const b = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, a, baseInput());
			await writeAnnouncement(ctx.tempDir, b, baseInput());

			await deleteAnnouncement(ctx.tempDir, a);

			const result = await parseAnnouncementsDir(ctx.tempDir);
			expect(result.parsed.length).toStrictEqual(1);
			expect(result.parsed[0].id).toStrictEqual(b);
		});

		// ─── id derivation ───────────────────────────────────────────────────

		this.test('writeAnnouncement uses the id as the filename', async (ctx) => {
			const id = generateAnnouncementId();
			await writeAnnouncement(ctx.tempDir, id, baseInput());

			const fileStat = await stat(`${ctx.tempDir}/announcements/${id}.md`);
			expect(fileStat).not.toBeOneOf([null, undefined]);
		});
	}
}

const suite = new DatabaseAnnouncementsAuthoringTest();
suite.runTests();
