import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from 'vitest';
import { runCommand } from '#utils/command.ts';
// eslint-disable-next-line profilarr/import-paths -- the review renderer lives in .github/, outside every alias
import {
	type Finding,
	MARKER,
	type Result,
	renderComment
} from '../../../.github/claude-review/render.ts';

const env = { repo: 'Dictionarry-Hub/profilarr', headSha: 'abc1234def', runUrl: 'https://run' };

const finding = (overrides: Partial<Finding> = {}): Finding => ({
	file: 'src/lib/server/sync/processor.ts',
	line: 42,
	title: 'Profiles skipped',
	problem: 'The loop exits on the first failure.',
	...overrides
});

const passing: Record<string, Result> = {
	'user-docs': { status: 'not_affected', findings: [] },
	'technical-docs': { status: 'up_to_date', findings: [] },
	tests: { status: 'covered', findings: [] },
	code: { status: 'no_issues', findings: [] }
};

function render(results: Record<string, Result | undefined>, websiteSha?: string): string {
	return renderComment(results, { 'user-docs': { website_sha: websiteSha } }, env);
}

function row(comment: string, title: string): string {
	const line = comment.split('\n').find((l) => l.startsWith(`| ${title} |`));
	expect(line, `missing row for ${title}`).toBeTruthy();
	return line!;
}

test('clean reviews render as one table with N/A findings', () => {
	const comment = render(passing);
	const lines = comment.split('\n');

	expect(lines[0]).toStrictEqual(MARKER);
	expect(lines[1]).toStrictEqual('| Review | Result | Findings |');
	expect(lines.at(-1)).toStrictEqual('<sub>Re-run with <code>@claude review</code></sub>');
	for (const title of ['User-facing docs', 'Technical docs', 'Tests', 'Code']) {
		expect(row(comment, title).split(' | ').slice(1)).toStrictEqual(['Passed', 'N/A |']);
	}
	expect(!comment.includes('---')).toBeTruthy();
	expect(!comment.includes('###')).toBeTruthy();
});

test('statuses map to Passed, Warning, or Failed', () => {
	const comment = render({
		'user-docs': { status: 'could_not_check', findings: [] },
		'technical-docs': { status: 'needs_update', findings: [finding()] },
		tests: { status: 'not_applicable', findings: [] },
		code: { status: 'issues', findings: [finding({ category: 'bug' })] }
	});

	expect(row(comment, 'User-facing docs')).toContain('| Warning |');
	expect(row(comment, 'Technical docs')).toContain('| Warning |');
	expect(row(comment, 'Tests')).toContain('| Passed |');
	expect(row(comment, 'Code')).toContain('| Failed |');
});

test('missing or unknown results render as failed reviews', () => {
	const comment = render({ ...passing, tests: undefined, code: { status: 'maybe', findings: [] } });

	for (const title of ['Tests', 'Code']) {
		const line = row(comment, title);
		expect(line).toContain('| Failed |');
		expect(line).toContain('[workflow run](https://run)');
	}
});

test('findings render as bullets with a category and one trailing period', () => {
	const comment = render({
		...passing,
		code: {
			status: 'issues',
			findings: [finding({ category: 'data_loss', title: 'Ops dropped.' })]
		}
	});

	expect(row(comment, 'Code')).toContain(
		'<ul><li>**Data loss: Ops dropped.** The loop exits on the first failure. '
	);
});

test('findings are capped at five', () => {
	const findings = Array.from({ length: 7 }, (_, i) => finding({ title: `Finding ${i}` }));
	const comment = render({ ...passing, code: { status: 'issues', findings } });

	expect(row(comment, 'Code').match(/<li>/g)?.length).toStrictEqual(5);
});

test('model text cannot add HTML, table cells, line breaks, or mentions', () => {
	const comment = render({
		...passing,
		code: {
			status: 'issues',
			findings: [finding({ problem: 'Ping @someone <b>now</b> | extra\ncell' })]
		}
	});
	const line = row(comment, 'Code');

	expect(line).toContain('Ping @​someone &lt;b&gt;now&lt;/b&gt; \\| extra cell');
	expect(comment.split('\n').length).toStrictEqual(9);
});

test('links point at the PR head or the reviewed website commit', () => {
	const comment = render(
		{
			...passing,
			'user-docs': {
				status: 'needs_update',
				findings: [finding({ file: 'website/src/routes/(docs)/sync/+page.svx', line: 3 })]
			},
			code: { status: 'issues', findings: [finding({ file: 'pr-head/src/app.ts', line: 7 })] }
		},
		'site123'
	);

	expect(row(comment, 'User-facing docs')).toContain(
		'[+page.svx#L3](https://github.com/Dictionarry-Hub/profilarr.com/blob/site123/src/routes/%28docs%29/sync/+page.svx#L3 "src/routes/(docs)/sync/+page.svx")'
	);
	expect(row(comment, 'Code')).toContain(
		'[app.ts#L7](https://github.com/Dictionarry-Hub/profilarr/blob/abc1234def/src/app.ts#L7 "src/app.ts")'
	);
});

test('CLI reads result files and environment, and fails rows it cannot read', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'claude-review-'));
	const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
	try {
		const write = async (review: string, file: string, content: string) => {
			await mkdir(`${directory}/claude-review-${review}`, { recursive: true });
			await writeFile(`${directory}/claude-review-${review}/${file}`, content);
		};
		await write(
			'user-docs',
			'result.json',
			JSON.stringify({ status: 'needs_update', findings: [finding({ file: 'src/a.svx' })] })
		);
		await write('user-docs', 'meta.json', JSON.stringify({ website_sha: 'site123' }));
		await write('technical-docs', 'result.json', JSON.stringify(passing['technical-docs']));
		await write('tests', 'result.json', '{ not json');
		// No result directory for code: its job didn't upload anything.

		// Run the renderer the way the Claude Review workflow does
		const run = (args: string[], allowed = directory) =>
			runCommand(
				process.execPath,
				['--permission', `--allow-fs-read=${allowed}`, '.github/claude-review/render.ts', ...args],
				{ env: { REPO: env.repo, HEAD_SHA: env.headSha, RUN_URL: env.runUrl } }
			);

		const output = await run([directory]);
		expect(output.code, decode(output.stderr)).toStrictEqual(0);
		const comment = decode(output.stdout);
		expect(row(comment, 'User-facing docs')).toContain('| Warning |');
		expect(row(comment, 'User-facing docs')).toContain(
			'https://github.com/Dictionarry-Hub/profilarr.com/blob/site123/src/a.svx#L42'
		);
		expect(row(comment, 'Technical docs')).toContain('| Passed | N/A |');
		for (const title of ['Tests', 'Code']) {
			expect(row(comment, title)).toContain('| Failed |');
			expect(row(comment, title)).toContain('[workflow run](https://run)');
		}

		const usage = await run([]);
		expect(usage.code).toStrictEqual(1);
		expect(decode(usage.stderr)).toContain('Usage: render.ts <results-dir>');

		// The sandbox only lets it read the results: outside them every row fails
		const denied = decode((await run([directory], `${directory}/missing`)).stdout);
		for (const title of ['User-facing docs', 'Technical docs']) {
			expect(row(denied, title)).toContain('| Failed |');
		}
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
