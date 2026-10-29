/**
 * Record how long each flow spec file takes, so `deno task test:flows --deal`
 * splits the files into shards that take about as long as each other.
 *
 *   deno task flows:timings [dir]
 *
 * `dir` holds Playwright blob reports: `blob-report` after a local
 * `deno task test:flows --reporter=blob`, or CI's `flow-blob-*` artifacts from
 * `gh run download <run> --pattern 'flow-blob-*'`. Every `.zip` under it is
 * read. A test that ran several times, e.g. with `--repeat-each`, counts once
 * at its average. The result goes to tests/flows/harness/timings.json.
 *
 * For timings close to CI's, run locally with `FLOWS_WORKERS=4` and
 * `--online`, as each CI shard does.
 */

import { spawnSync } from 'node:child_process';
import {
	copyFileSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import process from 'node:process';
import { dealSpecFiles } from '#flows/harness/specFiles.ts';

const FLOWS_DIR = 'tests/flows';
const TIMINGS = `${FLOWS_DIR}/harness/timings.json`;
const SHARDS = 4;

interface JsonSpec {
	id: string;
	file: string;
	tests: { results: { duration: number }[] }[];
}
interface JsonSuite {
	specs?: JsonSpec[];
	suites?: JsonSuite[];
}

function findZips(dir: string): string[] {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return findZips(path);
		return name.endsWith('.zip') ? [path] : [];
	});
}

function specsOf(suite: JsonSuite): JsonSpec[] {
	return [...(suite.specs ?? []), ...(suite.suites ?? []).flatMap(specsOf)];
}

const dir = process.argv[2] ?? 'blob-report';
const zips = findZips(dir);
if (zips.length === 0) {
	console.error(`No blob reports (.zip) under ${dir}`);
	process.exit(2);
}

// merge-reports reads one folder, and CI's artifacts sit in one folder each.
// The JSON goes to a file: piped stdout can be cut short when the process exits.
const merged = mkdtempSync(join(tmpdir(), 'flow-blobs-'));
const jsonFile = join(merged, 'report.json');
zips.forEach((zip, index) => copyFileSync(zip, join(merged, `report-${index}.zip`)));
const report = spawnSync(
	'node',
	['node_modules/playwright/cli.js', 'merge-reports', '--reporter=json', merged],
	{ encoding: 'utf8', env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile } }
);
if (report.status !== 0) {
	console.error(report.stderr);
	process.exit(report.status ?? 1);
}
const json = JSON.parse(readFileSync(jsonFile, 'utf8'));
rmSync(merged, { recursive: true, force: true });

// Each test counts once at its average time. A file's time is its tests' sum.
const seconds = new Map<string, number>();
for (const spec of specsOf(json)) {
	const runs = spec.tests.flatMap((test) => test.results.map((result) => result.duration));
	if (runs.length === 0) continue;
	const average = runs.reduce((sum, ms) => sum + ms, 0) / runs.length / 1000;
	seconds.set(spec.file, (seconds.get(spec.file) ?? 0) + average);
}

const files = Object.fromEntries(
	[...seconds.entries()]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([file, time]) => [file, Math.round(time * 10) / 10])
);
writeFileSync(TIMINGS, `${JSON.stringify({ files }, null, '\t')}\n`);
console.log(`Wrote ${Object.keys(files).length} spec files to ${relative('.', TIMINGS)}`);

// How the deal would split them now
const all = Object.keys(files);
for (let shard = 1; shard <= SHARDS; shard++) {
	const dealt = dealSpecFiles(all, shard, SHARDS, files);
	const time = dealt.reduce((sum, file) => sum + files[file], 0);
	console.log(`  shard ${shard}: ${dealt.length} files, ${Math.round(time)} s of test time`);
}
