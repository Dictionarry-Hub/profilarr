import { readFileSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { expect, test } from 'vitest';
import { runCommand } from '#utils/command.ts';
import { validatePrDescription } from '#scripts/check-pr-description.ts';

// Fictional PR bodies exercise contributor-facing behavior, not GitHub API calls.
const fixture = (name: string) =>
	readFileSync(new URL(`./fixtures/${name}.md`, import.meta.url), 'utf8');
const docs = fixture('docs');

function replaceSection(body: string, title: string, content: string): string {
	return body.replace(new RegExp(`(## ${title}\\n)[\\s\\S]*?(?=\\n## |$)`), `$1\n${content}\n`);
}

for (const name of ['docs', 'feature', 'visual']) {
	test(`PR description: accepts a complete ${name} PR`, () => {
		const result = validatePrDescription(fixture(name));
		expect(result.errors).toStrictEqual([]);
		expect(result.warnings).toStrictEqual([]);
	});
}

for (const title of [
	'Description',
	'User-facing docs',
	'Technical docs',
	'Testing',
	'Confirmation'
]) {
	test(`PR description: requires ${title}`, () => {
		const body = docs.replace(new RegExp(`## ${title}\\n[\\s\\S]*?(?=\\n## |$)`), '');
		expect(
			validatePrDescription(body).errors.includes(`Add the "## ${title}" section.`)
		).toBeTruthy();
	});
}

for (const title of ['Description', 'User-facing docs', 'Technical docs', 'Testing']) {
	for (const content of ['', '<!-- Answer goes here. -->', '### Details', 'N/A', 'TBD']) {
		test(`PR description: rejects an unanswered ${title}: ${JSON.stringify(content)}`, () => {
			const result = validatePrDescription(replaceSection(docs, title, content));
			expect(result.errors.some((error) => error.startsWith(`Answer "${title}"`))).toBeTruthy();
		});
	}
}

test('PR description: absent body fails all required sections', () => {
	expect(validatePrDescription(null).errors.length).toStrictEqual(5);
});

test('PR description: optional sections can be absent or empty', () => {
	expect(
		validatePrDescription(`${docs}\n## Related issue\n\n## Upgrade impact\n`).errors
	).toStrictEqual([]);
});

test('PR description: honestly reporting missing verification is accepted', () => {
	const body = replaceSection(docs, 'Testing', "I haven't verified this change yet.");
	expect(validatePrDescription(body).errors).toStrictEqual([]);
});

test('PR description: ignores heading case, CRLF, and closing hashes', () => {
	const body = docs
		.replace(/^## (.+)$/gm, (_, title) => `  ## ${title.toUpperCase()} ##`)
		.replace(/\n/g, '\r\n');
	expect(validatePrDescription(body).errors).toStrictEqual([]);
});

test('PR description: duplicate required or optional sections fail', () => {
	for (const title of ['Description', 'Related issue', 'Upgrade impact', 'Confirmation']) {
		const body = `${fixture('feature')}\n## ${title}\nMore context.\n`;
		expect(
			validatePrDescription(body).errors.includes(`Keep only one "${title}" section.`)
		).toBeTruthy();
	}
});

test('PR description: unexpected top-level headings fail with a useful location', () => {
	for (const heading of ['## Generated summary', '# Implementation']) {
		const errors = validatePrDescription(`${docs}\n${heading}\nExtra detail.`).errors;
		expect(
			errors.some((error) => error.startsWith('Unexpected') && error.includes('line'))
		).toBeTruthy();
	}
});

test('PR description: introductory text must go under Description', () => {
	expect(
		validatePrDescription(`A generated preamble.\n${docs}`).errors.some((e) =>
			e.includes('introductory')
		)
	).toBeTruthy();
});

test('PR description: ignores multiline comments and preserves adjacent text', () => {
	const body = replaceSection(
		docs,
		'Description',
		'Clarify<!--\n## Generated summary\n- [ ] Example\n--> the OIDC settings.'
	);
	expect(validatePrDescription(body).errors).toStrictEqual([]);
});

for (const delimiter of ['```', '~~~~']) {
	test(`PR description: ${delimiter} code samples cannot add headings or confirmations`, () => {
		const example = `${delimiter}markdown\n## Generated summary\n${delimiter}`;
		expect(
			validatePrDescription(replaceSection(docs, 'Description', `Clarify docs.\n${example}`)).errors
		).toStrictEqual([]);
		const checklist = docs.split('## Confirmation\n')[1];
		const result = validatePrDescription(
			replaceSection(docs, 'Confirmation', `${delimiter}markdown\n${checklist}${delimiter}`)
		);
		expect(result.errors.length).toStrictEqual(3);
	});
}

test('PR description: HTML comment examples in code do not hide later sections', () => {
	const body = replaceSection(docs, 'Description', 'Clarify docs.\n```html\n<!-- Example\n```');
	expect(validatePrDescription(body).errors).toStrictEqual([]);
});

test('PR description: shorter or mismatched fences do not end a code sample', () => {
	const body = replaceSection(
		docs,
		'Description',
		'Clarify docs.\n````markdown\n```\n~~~\n## Generated summary\n````'
	);
	expect(validatePrDescription(body).errors).toStrictEqual([]);
});

test('PR description: unchecked, missing, or replaced confirmations fail', () => {
	const checklist = docs.split('## Confirmation\n')[1];
	for (const content of [
		checklist.replace('[x]', '[ ]'),
		checklist.replace(/^- \[x\] I have read.*\n/m, ''),
		checklist.replace('I have read and followed', 'I disagree with')
	]) {
		expect(
			validatePrDescription(replaceSection(docs, 'Confirmation', content)).errors.length
		).toStrictEqual(1);
	}
});

test('PR description: checked lookalikes elsewhere do not satisfy confirmations', () => {
	const misplaced = replaceSection(
		replaceSection(docs, 'Description', docs.split('## Confirmation\n')[1]),
		'Confirmation',
		'<!-- Confirmations are above. -->'
	);
	expect(validatePrDescription(misplaced).errors.length).toStrictEqual(3);
});

test('PR description: confirmations in comments cannot satisfy the checklist', () => {
	const checklist = docs.split('## Confirmation\n')[1];
	expect(
		validatePrDescription(replaceSection(docs, 'Confirmation', `<!--\n${checklist}\n-->`)).errors
			.length
	).toStrictEqual(3);
});

test('PR description: duplicate confirmations fail', () => {
	const body = `${docs}\n- [x] I have read and followed the contribution guidelines.\n`;
	expect(validatePrDescription(body).errors.length).toStrictEqual(1);
});

test('PR description: uppercase checks and unwrapped confirmation text are accepted', () => {
	const body = docs.replace(/\[x\]/g, '[X]').replace(/\n {6}/g, ' ');
	expect(validatePrDescription(body).errors).toStrictEqual([]);
});

test('PR description: untouched repository template fails for empty answers and unchecked boxes', () => {
	const template = readFileSync(
		new URL('../../../.github/pull_request_template.md', import.meta.url),
		'utf8'
	);
	const result = validatePrDescription(template);
	expect(result.errors.length).toStrictEqual(7);
	expect(result.wordCounts).toStrictEqual({ description: 0, body: 0 });
});

test('PR description: description warning starts above 150 words and does not fail', () => {
	for (const count of [150, 151]) {
		const result = validatePrDescription(
			replaceSection(docs, 'Description', 'word '.repeat(count))
		);
		expect(result.errors).toStrictEqual([]);
		expect(result.wordCounts.description).toStrictEqual(count);
		expect(result.warnings.length).toStrictEqual(count > 150 ? 1 : 0);
	}
});

test('PR description: total warning starts above 400 words and excludes confirmations', () => {
	const baseline = validatePrDescription(docs).wordCounts.body;
	for (const count of [400, 401]) {
		const result = validatePrDescription(
			`${docs}\n## Upgrade impact\n${'word '.repeat(count - baseline)}`
		);
		expect(result.errors).toStrictEqual([]);
		expect(result.wordCounts.body).toStrictEqual(count);
		expect(result.warnings.length).toStrictEqual(count > 400 ? 1 : 0);
	}
});

test('PR description: long hidden instructions and link destinations do not inflate word counts', () => {
	const baseline = validatePrDescription(docs).wordCounts;
	const body = docs
		.replace('which OIDC settings', `which <!-- ${'word '.repeat(500)} -->OIDC settings`)
		.replace('required for SSO.', 'required for [SSO](https://example.com/a/very/long/link).');
	expect(validatePrDescription(body).wordCounts).toStrictEqual(baseline);
});

test('PR description CLI: valid input succeeds, warnings succeed, invalid input fails', async () => {
	const directory = await mkdtemp(join(tmpdir(), 'pr-description-'));
	const decode = (bytes: Uint8Array) => new TextDecoder().decode(bytes);
	// Run the script the way the PR Description workflow does
	const check = (allowed: string, path: string) =>
		runCommand(process.execPath, [
			'--permission',
			`--allow-fs-read=${allowed}`,
			'scripts/check-pr-description.ts',
			path
		]);
	try {
		const path = `${directory}/body.md`;
		for (const sample of [
			{ body: docs, code: 0, message: 'meets the template requirements' },
			{
				body: replaceSection(docs, 'Description', 'word '.repeat(151)),
				code: 0,
				message: '::warning'
			},
			{ body: '', code: 1, message: '::error' }
		]) {
			await writeFile(path, sample.body);
			const output = await check(path, path);
			expect(output.code, decode(output.stderr)).toStrictEqual(sample.code);
			expect(decode(output.stdout)).toContain(sample.message);
		}

		// The sandbox only lets it read the allowed file
		const other = `${directory}/other.md`;
		await writeFile(other, docs);
		const denied = await check(path, other);
		expect(denied.code).toStrictEqual(1);
		expect(decode(denied.stderr)).toContain('ERR_ACCESS_DENIED');
	} finally {
		await rm(directory, { recursive: true, force: true });
	}
});
