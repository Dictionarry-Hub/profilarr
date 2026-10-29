import { assertEquals, assertRejects } from '@std/assert';
import { cliffArgs, readNotes, tagArgs } from '#scripts/release.ts';

const NOTES = '### Upgrade notes\n\n- `AUTH=oidc` is deprecated.';

async function withNotesFile(content: string, fn: (path: string) => Promise<void>) {
	const path = await Deno.makeTempFile({ suffix: '.md' });
	try {
		await Deno.writeTextFile(path, content);
		await fn(path);
	} finally {
		await Deno.remove(path);
	}
}

Deno.test('Release notes: no path means no notes', async () => {
	assertEquals(await readNotes(undefined), null);
});

Deno.test('Release notes: reads and trims the file', async () => {
	await withNotesFile(`\n${NOTES}\n\n`, async (path) => {
		assertEquals(await readNotes(path), NOTES);
	});
});

Deno.test('Release notes: rejects a missing file', async () => {
	const dir = await Deno.makeTempDir();
	try {
		await assertRejects(() => readNotes(`${dir}/missing.md`), Error, 'was not found');
	} finally {
		await Deno.remove(dir);
	}
});

Deno.test('Release notes: rejects an empty file', async () => {
	await withNotesFile(' \n\n', async (path) => {
		await assertRejects(() => readNotes(path), Error, 'is empty');
	});
});

Deno.test('Release dry run: passes notes to git-cliff as the tag message', () => {
	const base = ['--config', 'cliff.toml', '--unreleased', '--tag', 'v2.3.0'];
	assertEquals(cliffArgs('v2.3.0', null), base);
	assertEquals(cliffArgs('v2.3.0', NOTES), [...base, '--with-tag-message', NOTES]);
});

Deno.test('Release tag: annotated tag keeps markdown headings', () => {
	assertEquals(tagArgs('v2.3.0', null), ['tag', 'v2.3.0']);
	assertEquals(tagArgs('v2.3.0', NOTES), [
		'tag',
		'-a',
		'--cleanup=whitespace',
		'-m',
		NOTES,
		'v2.3.0'
	]);
});
