/**
 * Refresh the flow test fixtures from GitHub.
 *
 * Replaces tests/flows/data/fixtures with a fresh copy of the
 * Dictionarry-Hub/fixtures database, and tests/flows/data/schema with the
 * schema version that database depends on. Both are committed, so the flow
 * tests never clone from GitHub. It then compiles them and writes
 * tests/flows/data/fixtures.json, the snapshot scenarios read expected names
 * and values from. Run after changing the fixtures database:
 *
 *   pnpm fixtures:update            latest default branch
 *   pnpm fixtures:update <ref>      a branch, tag or commit
 */

import { spawnSync } from 'node:child_process';
import * as fs from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { buildSnapshot } from '#flows/harness/fixtureSnapshot.ts';

const FIXTURES_REPO = 'https://github.com/Dictionarry-Hub/fixtures';
const DATA_DIR = 'tests/flows/data';
// Repo files the tests don't need
const SKIP = new Set(['.git', '.github', '.gitignore']);

function git(args: string[], cwd?: string): string {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
	if (result.status !== 0) {
		throw new Error(`git ${args.join(' ')} failed:\n${result.stderr}`);
	}
	return result.stdout.trim();
}

/** Clone a repo at a ref (branch, tag or commit) and return its commit SHA */
function cloneAt(url: string, ref: string | undefined, dest: string): string {
	git(['clone', '--quiet', url, dest]);
	if (ref) git(['checkout', '--quiet', ref], dest);
	return git(['rev-parse', 'HEAD'], dest);
}

/** Replace `dest` with the contents of `src`, leaving out SKIP entries or keeping only `only` */
async function replaceWith(src: string, dest: string, only?: string[]): Promise<void> {
	await fs.rm(dest, { recursive: true, force: true });
	await fs.mkdir(dest, { recursive: true });
	for (const entry of await fs.readdir(src)) {
		if (only ? !only.includes(entry) : SKIP.has(entry)) continue;
		await fs.cp(join(src, entry), join(dest, entry), { recursive: true });
	}
}

/** The schema repo URL and version from a PCD manifest */
function schemaDependency(manifest: { dependencies?: Record<string, string> }): {
	url: string;
	version: string;
} {
	const entry = Object.entries(manifest.dependencies ?? {}).find(([url]) =>
		url.toLowerCase().includes('dictionarry-hub/schema')
	);
	if (!entry) throw new Error('fixtures pcd.json has no schema dependency');
	return { url: entry[0], version: entry[1] };
}

const ref = process.argv[2];
const work = await fs.mkdtemp(join(tmpdir(), 'profilarr-fixtures-'));

try {
	const fixturesSrc = join(work, 'fixtures');
	const fixturesCommit = cloneAt(FIXTURES_REPO, ref, fixturesSrc);
	const manifest = JSON.parse(await fs.readFile(join(fixturesSrc, 'pcd.json'), 'utf8'));
	const schema = schemaDependency(manifest);

	const schemaSrc = join(work, 'schema');
	const schemaCommit = cloneAt(schema.url, schema.version, schemaSrc);

	await replaceWith(fixturesSrc, join(DATA_DIR, 'fixtures'));
	// Compiling only needs the schema's ops; its docs and scripts stay upstream
	await replaceWith(schemaSrc, join(DATA_DIR, 'schema'), ['pcd.json', 'ops']);

	const source = {
		fixtures: { repository: FIXTURES_REPO, commit: fixturesCommit },
		schema: { repository: schema.url, version: schema.version, commit: schemaCommit }
	};
	await fs.writeFile(join(DATA_DIR, 'source.json'), `${JSON.stringify(source, null, '\t')}\n`);

	// Fails here if the ops no longer compile against the schema
	const snapshot = await buildSnapshot(
		join(DATA_DIR, 'schema/ops'),
		join(DATA_DIR, 'fixtures/ops')
	);
	await fs.writeFile(join(DATA_DIR, 'fixtures.json'), `${JSON.stringify(snapshot, null, '\t')}\n`);

	console.log(`fixtures  ${fixturesCommit.slice(0, 7)}  (${ref ?? 'default branch'})`);
	console.log(`schema    ${schemaCommit.slice(0, 7)}  (${schema.version})`);
	console.log(git(['status', '--short', '--', DATA_DIR]) || 'No changes.');
} finally {
	await fs.rm(work, { recursive: true, force: true });
}
