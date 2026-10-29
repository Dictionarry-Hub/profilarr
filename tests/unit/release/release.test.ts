import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, test } from 'vitest';
import { cliffArgs, readNotes, tagArgs } from '#scripts/release.ts';

const NOTES = '### Upgrade notes\n\n- `AUTH=oidc` is deprecated.';

async function withNotesFile(content: string, fn: (path: string) => Promise<void>) {
	const dir = await mkdtemp(join(tmpdir(), 'release-notes-'));
	const path = join(dir, 'notes.md');
	try {
		await writeFile(path, content);
		await fn(path);
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

test('Release notes: no path means no notes', async () => {
	expect(await readNotes(undefined)).toStrictEqual(null);
});

test('Release notes: reads and trims the file', async () => {
	await withNotesFile(`\n${NOTES}\n\n`, async (path) => {
		expect(await readNotes(path)).toStrictEqual(NOTES);
	});
});

test('Release notes: rejects a missing file', async () => {
	const dir = await mkdtemp(join(tmpdir(), 'release-notes-'));
	try {
		await expect(readNotes(`${dir}/missing.md`)).rejects.toThrow(Error);
		await expect(readNotes(`${dir}/missing.md`)).rejects.toThrow('was not found');
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
});

test('Release notes: rejects an empty file', async () => {
	await withNotesFile(' \n\n', async (path) => {
		await expect(readNotes(path)).rejects.toThrow(Error);
		await expect(readNotes(path)).rejects.toThrow('is empty');
	});
});

test('Release dry run: passes notes to git-cliff as the tag message', () => {
	const base = ['--config', 'cliff.toml', '--unreleased', '--tag', 'v2.3.0'];
	expect(cliffArgs('v2.3.0', null)).toStrictEqual(base);
	expect(cliffArgs('v2.3.0', NOTES)).toStrictEqual([...base, '--with-tag-message', NOTES]);
});

test('Release tag: annotated tag keeps markdown headings', () => {
	expect(tagArgs('v2.3.0', null)).toStrictEqual(['tag', 'v2.3.0']);
	expect(tagArgs('v2.3.0', NOTES)).toStrictEqual([
		'tag',
		'-a',
		'--cleanup=whitespace',
		'-m',
		NOTES,
		'v2.3.0'
	]);
});
