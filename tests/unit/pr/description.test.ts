import { assert, assertEquals, assertStringIncludes } from '@std/assert';
import { validatePrDescription } from '../../../scripts/check-pr-description.ts';

// Fictional PR bodies exercise contributor-facing behavior, not GitHub API calls.
const fixture = (name: string) =>
	Deno.readTextFileSync(new URL(`./fixtures/${name}.md`, import.meta.url));
const docs = fixture('docs');

function replaceSection(body: string, title: string, content: string): string {
	return body.replace(new RegExp(`(## ${title}\\n)[\\s\\S]*?(?=\\n## |$)`), `$1\n${content}\n`);
}

for (const name of ['docs', 'feature', 'visual']) {
	Deno.test(`PR description: accepts a complete ${name} PR`, () => {
		const result = validatePrDescription(fixture(name));
		assertEquals(result.errors, []);
		assertEquals(result.warnings, []);
	});
}

for (const title of [
	'Description',
	'User-facing docs',
	'Technical docs',
	'Testing',
	'Confirmation'
]) {
	Deno.test(`PR description: requires ${title}`, () => {
		const body = docs.replace(new RegExp(`## ${title}\\n[\\s\\S]*?(?=\\n## |$)`), '');
		assert(validatePrDescription(body).errors.includes(`Add the "## ${title}" section.`));
	});
}

for (const title of ['Description', 'User-facing docs', 'Technical docs', 'Testing']) {
	for (const content of ['', '<!-- Answer goes here. -->', '### Details', 'N/A', 'TBD']) {
		Deno.test(`PR description: rejects an unanswered ${title}: ${JSON.stringify(content)}`, () => {
			const result = validatePrDescription(replaceSection(docs, title, content));
			assert(result.errors.some((error) => error.startsWith(`Answer "${title}"`)));
		});
	}
}

Deno.test('PR description: absent body fails all required sections', () => {
	assertEquals(validatePrDescription(null).errors.length, 5);
});

Deno.test('PR description: optional sections can be absent or empty', () => {
	assertEquals(
		validatePrDescription(`${docs}\n## Related issue\n\n## Upgrade impact\n`).errors,
		[]
	);
});

Deno.test('PR description: honestly reporting missing verification is accepted', () => {
	const body = replaceSection(docs, 'Testing', "I haven't verified this change yet.");
	assertEquals(validatePrDescription(body).errors, []);
});

Deno.test('PR description: ignores heading case, CRLF, and closing hashes', () => {
	const body = docs
		.replace(/^## (.+)$/gm, (_, title) => `  ## ${title.toUpperCase()} ##`)
		.replace(/\n/g, '\r\n');
	assertEquals(validatePrDescription(body).errors, []);
});

Deno.test('PR description: duplicate required or optional sections fail', () => {
	for (const title of ['Description', 'Related issue', 'Upgrade impact', 'Confirmation']) {
		const body = `${fixture('feature')}\n## ${title}\nMore context.\n`;
		assert(validatePrDescription(body).errors.includes(`Keep only one "${title}" section.`));
	}
});

Deno.test('PR description: unexpected top-level headings fail with a useful location', () => {
	for (const heading of ['## Generated summary', '# Implementation']) {
		const errors = validatePrDescription(`${docs}\n${heading}\nExtra detail.`).errors;
		assert(errors.some((error) => error.startsWith('Unexpected') && error.includes('line')));
	}
});

Deno.test('PR description: introductory text must go under Description', () => {
	assert(
		validatePrDescription(`A generated preamble.\n${docs}`).errors.some((e) =>
			e.includes('introductory')
		)
	);
});

Deno.test('PR description: ignores multiline comments and preserves adjacent text', () => {
	const body = replaceSection(
		docs,
		'Description',
		'Clarify<!--\n## Generated summary\n- [ ] Example\n--> the OIDC settings.'
	);
	assertEquals(validatePrDescription(body).errors, []);
});

for (const delimiter of ['```', '~~~~']) {
	Deno.test(
		`PR description: ${delimiter} code samples cannot add headings or confirmations`,
		() => {
			const example = `${delimiter}markdown\n## Generated summary\n${delimiter}`;
			assertEquals(
				validatePrDescription(replaceSection(docs, 'Description', `Clarify docs.\n${example}`))
					.errors,
				[]
			);
			const checklist = docs.split('## Confirmation\n')[1];
			const result = validatePrDescription(
				replaceSection(docs, 'Confirmation', `${delimiter}markdown\n${checklist}${delimiter}`)
			);
			assertEquals(result.errors.length, 3);
		}
	);
}

Deno.test('PR description: HTML comment examples in code do not hide later sections', () => {
	const body = replaceSection(docs, 'Description', 'Clarify docs.\n```html\n<!-- Example\n```');
	assertEquals(validatePrDescription(body).errors, []);
});

Deno.test('PR description: shorter or mismatched fences do not end a code sample', () => {
	const body = replaceSection(
		docs,
		'Description',
		'Clarify docs.\n````markdown\n```\n~~~\n## Generated summary\n````'
	);
	assertEquals(validatePrDescription(body).errors, []);
});

Deno.test('PR description: unchecked, missing, or replaced confirmations fail', () => {
	const checklist = docs.split('## Confirmation\n')[1];
	for (const content of [
		checklist.replace('[x]', '[ ]'),
		checklist.replace(/^- \[x\] I have read.*\n/m, ''),
		checklist.replace('I have read and followed', 'I disagree with')
	]) {
		assertEquals(
			validatePrDescription(replaceSection(docs, 'Confirmation', content)).errors.length,
			1
		);
	}
});

Deno.test('PR description: checked lookalikes elsewhere do not satisfy confirmations', () => {
	const misplaced = replaceSection(
		replaceSection(docs, 'Description', docs.split('## Confirmation\n')[1]),
		'Confirmation',
		'<!-- Confirmations are above. -->'
	);
	assertEquals(validatePrDescription(misplaced).errors.length, 3);
});

Deno.test('PR description: confirmations in comments cannot satisfy the checklist', () => {
	const checklist = docs.split('## Confirmation\n')[1];
	assertEquals(
		validatePrDescription(replaceSection(docs, 'Confirmation', `<!--\n${checklist}\n-->`)).errors
			.length,
		3
	);
});

Deno.test('PR description: duplicate confirmations fail', () => {
	const body = `${docs}\n- [x] I have read and followed the contribution guidelines.\n`;
	assertEquals(validatePrDescription(body).errors.length, 1);
});

Deno.test('PR description: uppercase checks and unwrapped confirmation text are accepted', () => {
	const body = docs.replace(/\[x\]/g, '[X]').replace(/\n {6}/g, ' ');
	assertEquals(validatePrDescription(body).errors, []);
});

Deno.test(
	'PR description: untouched repository template fails for empty answers and unchecked boxes',
	() => {
		const template = Deno.readTextFileSync(
			new URL('../../../.github/pull_request_template.md', import.meta.url)
		);
		const result = validatePrDescription(template);
		assertEquals(result.errors.length, 7);
		assertEquals(result.wordCounts, { description: 0, body: 0 });
	}
);

Deno.test('PR description: description warning starts above 150 words and does not fail', () => {
	for (const count of [150, 151]) {
		const result = validatePrDescription(
			replaceSection(docs, 'Description', 'word '.repeat(count))
		);
		assertEquals(result.errors, []);
		assertEquals(result.wordCounts.description, count);
		assertEquals(result.warnings.length, count > 150 ? 1 : 0);
	}
});

Deno.test('PR description: total warning starts above 400 words and excludes confirmations', () => {
	const baseline = validatePrDescription(docs).wordCounts.body;
	for (const count of [400, 401]) {
		const result = validatePrDescription(
			`${docs}\n## Upgrade impact\n${'word '.repeat(count - baseline)}`
		);
		assertEquals(result.errors, []);
		assertEquals(result.wordCounts.body, count);
		assertEquals(result.warnings.length, count > 400 ? 1 : 0);
	}
});

Deno.test(
	'PR description: long hidden instructions and link destinations do not inflate word counts',
	() => {
		const baseline = validatePrDescription(docs).wordCounts;
		const body = docs
			.replace('which OIDC settings', `which <!-- ${'word '.repeat(500)} -->OIDC settings`)
			.replace('required for SSO.', 'required for [SSO](https://example.com/a/very/long/link).');
		assertEquals(validatePrDescription(body).wordCounts, baseline);
	}
);

Deno.test(
	'PR description CLI: valid input succeeds, warnings succeed, invalid input fails',
	async () => {
		const directory = await Deno.makeTempDir();
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
				await Deno.writeTextFile(path, sample.body);
				const output = await new Deno.Command(Deno.execPath(), {
					args: [
						'run',
						'--no-config',
						`--allow-read=${path}`,
						'scripts/check-pr-description.ts',
						path
					],
					stdout: 'piped',
					stderr: 'piped'
				}).output();
				assertEquals(output.code, sample.code, new TextDecoder().decode(output.stderr));
				assertStringIncludes(new TextDecoder().decode(output.stdout), sample.message);
			}
		} finally {
			await Deno.remove(directory, { recursive: true });
		}
	}
);
