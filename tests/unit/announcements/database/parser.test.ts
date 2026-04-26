/**
 * Tests for the database announcements parser. Verifies frontmatter +
 * markdown body extraction, validation, and the "skip + log invalid files"
 * behaviour. Pure filesystem operations, no DB.
 */

import { BaseTest } from '../../base/BaseTest.ts';
import { assertEquals, assertExists } from '@std/assert';
import { parseAnnouncementsDir } from '$announcements/database/parser.ts';

const VALID = `---
title: Migration to v2
severity: warning
published_at: 2026-04-20T10:00:00Z
expires_at: 2026-05-20T10:00:00Z
link: https://example.com/migration
---

# Migration guide

Run \`tool x\` then \`tool y\`.
`;

class DatabaseAnnouncementsParserTest extends BaseTest {
	private async writeAnnouncement(
		tempDir: string,
		filename: string,
		content: string
	): Promise<void> {
		const dir = `${tempDir}/announcements`;
		await Deno.mkdir(dir, { recursive: true });
		await Deno.writeTextFile(`${dir}/${filename}`, content);
	}

	runTests(): void {
		// ─── Empty / missing directory ───────────────────────────────────────

		this.test('missing announcements directory returns empty result', async (ctx) => {
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors, []);
		});

		this.test('empty announcements directory returns empty result', async (ctx) => {
			await Deno.mkdir(`${ctx.tempDir}/announcements`, { recursive: true });
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors, []);
		});

		// ─── Valid files ────────────────────────────────────────────────────

		this.test('single valid file parses', async (ctx) => {
			await this.writeAnnouncement(ctx.tempDir, '01HXYZ0000000000000000000A.md', VALID);
			const result = await parseAnnouncementsDir(ctx.tempDir);

			assertEquals(result.errors, []);
			assertEquals(result.parsed.length, 1);

			const a = result.parsed[0];
			assertEquals(a.id, '01HXYZ0000000000000000000A');
			assertEquals(a.title, 'Migration to v2');
			assertEquals(a.severity, 'warning');
			assertEquals(a.published_at, '2026-04-20T10:00:00Z');
			assertEquals(a.expires_at, '2026-05-20T10:00:00Z');
			assertEquals(a.link, 'https://example.com/migration');
			assertEquals(a.body, '# Migration guide\n\nRun `tool x` then `tool y`.\n');
		});

		this.test('id is derived from filename without .md extension', async (ctx) => {
			await this.writeAnnouncement(ctx.tempDir, 'custom-id-name.md', VALID);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed[0].id, 'custom-id-name');
		});

		this.test('optional fields default to null when absent', async (ctx) => {
			const minimal = `---
title: Hello
severity: info
published_at: 2026-04-20T10:00:00Z
---

Body here.
`;
			await this.writeAnnouncement(ctx.tempDir, 'minimal.md', minimal);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(result.parsed[0].expires_at, null);
			assertEquals(result.parsed[0].link, null);
		});

		this.test('multiple valid files all parse', async (ctx) => {
			await this.writeAnnouncement(ctx.tempDir, 'a.md', VALID);
			await this.writeAnnouncement(ctx.tempDir, 'b.md', VALID);
			await this.writeAnnouncement(ctx.tempDir, 'c.md', VALID);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(result.parsed.length, 3);
			const ids = result.parsed.map((p) => p.id).sort();
			assertEquals(ids, ['a', 'b', 'c']);
		});

		this.test('body preserves multi-line markdown verbatim', async (ctx) => {
			const multiline = `---
title: Multi
severity: info
published_at: 2026-04-20T10:00:00Z
---

Line 1.

\`\`\`bash
deno task dev
\`\`\`

- bullet
- list
`;
			await this.writeAnnouncement(ctx.tempDir, 'm.md', multiline);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(
				result.parsed[0].body,
				'Line 1.\n\n```bash\ndeno task dev\n```\n\n- bullet\n- list\n'
			);
		});

		this.test('empty body is allowed', async (ctx) => {
			const noBody = `---
title: No body
severity: info
published_at: 2026-04-20T10:00:00Z
---
`;
			await this.writeAnnouncement(ctx.tempDir, 'nb.md', noBody);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.errors, []);
			assertEquals(result.parsed[0].body, '');
		});

		// ─── Validation errors (skip + log) ──────────────────────────────────

		this.test('missing required field title is reported and skipped', async (ctx) => {
			const noTitle = `---
severity: info
published_at: 2026-04-20T10:00:00Z
---
Body.
`;
			await this.writeAnnouncement(ctx.tempDir, 'broken.md', noTitle);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors.length, 1);
			assertEquals(result.errors[0].filename, 'broken.md');
		});

		this.test('invalid severity is reported and skipped', async (ctx) => {
			const badSev = `---
title: Bad
severity: catastrophic
published_at: 2026-04-20T10:00:00Z
---
Body.
`;
			await this.writeAnnouncement(ctx.tempDir, 'bad-sev.md', badSev);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors.length, 1);
		});

		this.test('unparseable published_at is reported and skipped', async (ctx) => {
			const bad = `---
title: Bad date
severity: info
published_at: not-a-date
---
Body.
`;
			await this.writeAnnouncement(ctx.tempDir, 'bad-date.md', bad);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors.length, 1);
		});

		this.test('malformed YAML frontmatter is reported and skipped', async (ctx) => {
			const broken = `---
title: "unclosed quote
severity: info
published_at: 2026-04-20T10:00:00Z
---
Body.
`;
			await this.writeAnnouncement(ctx.tempDir, 'mal.md', broken);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors.length, 1);
		});

		this.test('missing frontmatter delimiter is reported and skipped', async (ctx) => {
			await this.writeAnnouncement(ctx.tempDir, 'no-fm.md', '# Just a heading\n\nNo frontmatter.');
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed, []);
			assertEquals(result.errors.length, 1);
		});

		this.test('one bad file does not stop other files from parsing', async (ctx) => {
			await this.writeAnnouncement(ctx.tempDir, 'good.md', VALID);
			await this.writeAnnouncement(ctx.tempDir, 'bad.md', '# no frontmatter');
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed.length, 1);
			assertEquals(result.parsed[0].id, 'good');
			assertEquals(result.errors.length, 1);
			assertEquals(result.errors[0].filename, 'bad.md');
		});

		// ─── Non-target files ───────────────────────────────────────────────

		this.test('non-.md files are ignored', async (ctx) => {
			await this.writeAnnouncement(ctx.tempDir, 'real.md', VALID);
			await this.writeAnnouncement(ctx.tempDir, 'README.txt', 'plain text');
			await this.writeAnnouncement(ctx.tempDir, 'image.png', 'binary');
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed.length, 1);
			assertEquals(result.errors, []);
		});

		this.test('subdirectories inside announcements/ are ignored', async (ctx) => {
			await Deno.mkdir(`${ctx.tempDir}/announcements/nested`, { recursive: true });
			await Deno.writeTextFile(`${ctx.tempDir}/announcements/nested/x.md`, VALID);
			await this.writeAnnouncement(ctx.tempDir, 'top.md', VALID);
			const result = await parseAnnouncementsDir(ctx.tempDir);
			assertEquals(result.parsed.length, 1);
			assertExists(result.parsed.find((p) => p.id === 'top'));
		});
	}
}

const suite = new DatabaseAnnouncementsParserTest();
suite.runTests();
