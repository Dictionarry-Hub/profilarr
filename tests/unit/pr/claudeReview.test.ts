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
