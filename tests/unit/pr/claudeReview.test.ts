import { assert, assertEquals, assertStringIncludes } from '@std/assert';
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
	assert(line, `missing row for ${title}`);
	return line;
}

Deno.test('clean reviews render as one table with N/A findings', () => {
	const comment = render(passing);
	const lines = comment.split('\n');

	assertEquals(lines[0], MARKER);
	assertEquals(lines[1], '| Review | Result | Findings |');
	assertEquals(lines.at(-1), '<sub>Re-run with <code>@claude review</code></sub>');
	for (const title of ['User-facing docs', 'Technical docs', 'Tests', 'Code']) {
		assertEquals(row(comment, title).split(' | ').slice(1), ['Passed', 'N/A |']);
	}
	assert(!comment.includes('---'));
	assert(!comment.includes('###'));
});

Deno.test('statuses map to Passed, Warning, or Failed', () => {
	const comment = render({
		'user-docs': { status: 'could_not_check', findings: [] },
		'technical-docs': { status: 'needs_update', findings: [finding()] },
		tests: { status: 'not_applicable', findings: [] },
		code: { status: 'issues', findings: [finding({ category: 'bug' })] }
	});

	assertStringIncludes(row(comment, 'User-facing docs'), '| Warning |');
	assertStringIncludes(row(comment, 'Technical docs'), '| Warning |');
	assertStringIncludes(row(comment, 'Tests'), '| Passed |');
	assertStringIncludes(row(comment, 'Code'), '| Failed |');
});

Deno.test('missing or unknown results render as failed reviews', () => {
	const comment = render({ ...passing, tests: undefined, code: { status: 'maybe', findings: [] } });

	for (const title of ['Tests', 'Code']) {
		const line = row(comment, title);
		assertStringIncludes(line, '| Failed |');
		assertStringIncludes(line, '[workflow run](https://run)');
	}
});

Deno.test('findings render as bullets with a category and one trailing period', () => {
	const comment = render({
		...passing,
		code: {
			status: 'issues',
			findings: [finding({ category: 'data_loss', title: 'Ops dropped.' })]
		}
	});

	assertStringIncludes(
		row(comment, 'Code'),
		'<ul><li>**Data loss: Ops dropped.** The loop exits on the first failure. '
	);
});

Deno.test('findings are capped at five', () => {
	const findings = Array.from({ length: 7 }, (_, i) => finding({ title: `Finding ${i}` }));
	const comment = render({ ...passing, code: { status: 'issues', findings } });

	assertEquals(row(comment, 'Code').match(/<li>/g)?.length, 5);
});

Deno.test('model text cannot add HTML, table cells, line breaks, or mentions', () => {
	const comment = render({
		...passing,
		code: {
			status: 'issues',
			findings: [finding({ problem: 'Ping @someone <b>now</b> | extra\ncell' })]
		}
	});
	const line = row(comment, 'Code');

	assertStringIncludes(line, 'Ping @​someone &lt;b&gt;now&lt;/b&gt; \\| extra cell');
	assertEquals(comment.split('\n').length, 9);
});

Deno.test('links point at the PR head or the reviewed website commit', () => {
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

	assertStringIncludes(
		row(comment, 'User-facing docs'),
		'[+page.svx#L3](https://github.com/Dictionarry-Hub/profilarr.com/blob/site123/src/routes/%28docs%29/sync/+page.svx#L3 "src/routes/(docs)/sync/+page.svx")'
	);
	assertStringIncludes(
		row(comment, 'Code'),
		'[app.ts#L7](https://github.com/Dictionarry-Hub/profilarr/blob/abc1234def/src/app.ts#L7 "src/app.ts")'
	);
});

Deno.test('CLI reads result files and environment, and fails rows it cannot read', async () => {
	const directory = await Deno.makeTempDir();
	const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
	try {
		const write = async (review: string, file: string, content: string) => {
			await Deno.mkdir(`${directory}/claude-review-${review}`, { recursive: true });
			await Deno.writeTextFile(`${directory}/claude-review-${review}/${file}`, content);
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

		const run = (args: string[]) =>
			new Deno.Command(Deno.execPath(), {
				args: [
					'run',
					'--no-config',
					`--allow-read=${directory}`,
					'--allow-env=REPO,HEAD_SHA,RUN_URL',
					'.github/claude-review/render.ts',
					...args
				],
				env: { REPO: env.repo, HEAD_SHA: env.headSha, RUN_URL: env.runUrl },
				stdout: 'piped',
				stderr: 'piped'
			}).output();

		const output = await run([directory]);
		assertEquals(output.code, 0, decode(output.stderr));
		const comment = decode(output.stdout);
		assertStringIncludes(row(comment, 'User-facing docs'), '| Warning |');
		assertStringIncludes(
			row(comment, 'User-facing docs'),
			'https://github.com/Dictionarry-Hub/profilarr.com/blob/site123/src/a.svx#L42'
		);
		assertStringIncludes(row(comment, 'Technical docs'), '| Passed | N/A |');
		for (const title of ['Tests', 'Code']) {
			assertStringIncludes(row(comment, title), '| Failed |');
			assertStringIncludes(row(comment, title), '[workflow run](https://run)');
		}

		const usage = await run([]);
		assertEquals(usage.code, 1);
		assertStringIncludes(decode(usage.stderr), 'Usage: render.ts <results-dir>');
	} finally {
		await Deno.remove(directory, { recursive: true });
	}
});
