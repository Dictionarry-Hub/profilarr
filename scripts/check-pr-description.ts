/** PR description rules. No GitHub access or application dependencies are needed. */

const REQUIRED_SECTIONS = [
	'Description',
	'User-facing docs',
	'Technical docs',
	'Testing',
	'Confirmation'
];
const OPTIONAL_SECTIONS = ['Related issue', 'Upgrade impact'];
const CONFIRMATIONS = [
	'I have read and followed the contribution guidelines.',
	'I have reviewed this contribution, including any AI-written code or text, understand the changes, and can address review feedback.',
	'The description and any claimed verification accurately reflect what changed and what I actually checked.'
];

const DESCRIPTION_WORD_LIMIT = 150;
const BODY_WORD_LIMIT = 400;

export interface ValidationResult {
	errors: string[];
	warnings: string[];
	wordCounts: { description: number; body: number };
}

interface ContentLine {
	text: string;
	code: boolean;
}

interface Section {
	name: string;
	lines: ContentLine[];
}

function normalize(text: string): string {
	return text
		.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\.$/, '')
		.toLowerCase();
}

function wordCount(text: string): number {
	return (
		text
			.replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
			.replace(/https?:\/\/\S+/g, 'link')
			.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu)?.length ?? 0
	);
}

/** Headings and checkbox examples inside fenced code are never interpreted as structure. */
function parseSections(body: string, errors: string[]): Section[] {
	const sections: Section[] = [];
	let current: Section | undefined;
	let comment = false;
	let fence: { marker: string; length: number } | undefined;
	let preamble = false;

	for (const [index, raw] of body.replace(/\r\n?/g, '\n').split('\n').entries()) {
		if (fence) {
			const closing = raw.match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
			if (closing && closing[1][0] === fence.marker && closing[1].length >= fence.length) {
				fence = undefined;
			} else if (current) {
				current.lines.push({ text: raw, code: true });
			} else if (raw.trim()) {
				preamble = true;
			}
			continue;
		}

		// Strip comments outside code, preserving surrounding text and line boundaries.
		let line = '';
		let rest = raw;
		while (rest) {
			const marker = rest.indexOf(comment ? '-->' : '<!--');
			if (marker === -1) {
				if (!comment) line += rest;
				break;
			}
			if (!comment) line += rest.slice(0, marker);
			rest = rest.slice(marker + (comment ? 3 : 4));
			comment = !comment;
		}

		const opening = line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
		if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
			fence = { marker: opening[1][0], length: opening[1].length };
			continue;
		}

		const heading = line.match(/^ {0,3}(#{1,6})(?:[ \t]+(.*?)|[ \t]*)$/);
		if (heading) {
			const level = heading[1].length;
			if (level === 2) {
				const name = (heading[2] ?? '').replace(/[ \t]+#+[ \t]*$/, '').trim();
				current = { name: normalize(name), lines: [] };
				sections.push(current);
				const known = [...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS].some(
					(title) => normalize(title) === normalize(name)
				);
				if (!known) {
					errors.push(
						`Unexpected section on line ${index + 1}. Use only the template's ## headings.`
					);
				}
			} else if (level === 1) {
				errors.push(`Unexpected # heading on line ${index + 1}. Use the template's ## headings.`);
			}
			continue;
		}

		if (current) current.lines.push({ text: line, code: false });
		else if (line.trim()) preamble = true;
	}

	if (preamble) errors.push('Move introductory text into the Description section.');
	return sections;
}

function readCheckboxes(lines: ContentLine[]): { checked: boolean; text: string }[] {
	const items: { checked: boolean; text: string }[] = [];
	let current: { checked: boolean; text: string } | undefined;
	for (const line of lines) {
		if (line.code) {
			current = undefined;
			continue;
		}
		const item = line.text.match(/^ {0,3}[-*+] \[([ xX])\][ \t]+(.+)$/);
		if (item) {
			current = { checked: item[1].toLowerCase() === 'x', text: item[2] };
			items.push(current);
		} else if (current && /^[ \t]+\S/.test(line.text)) {
			current.text += ` ${line.text.trim()}`;
		} else {
			current = undefined;
		}
	}
	return items;
}

export function validatePrDescription(body: string | null): ValidationResult {
	const errors: string[] = [];
	const warnings: string[] = [];
	const sections = parseSections(body ?? '', errors);

	for (const title of [...REQUIRED_SECTIONS, ...OPTIONAL_SECTIONS]) {
		const matches = sections.filter((section) => section.name === normalize(title));
		if (matches.length > 1) errors.push(`Keep only one "${title}" section.`);
		if (!REQUIRED_SECTIONS.includes(title)) continue;
		if (!matches.length) {
			errors.push(`Add the "## ${title}" section.`);
			continue;
		}
		if (title === 'Confirmation') continue;
		const answer = matches[0].lines
			.map((line) => line.text)
			.join('\n')
			.trim();
		if (
			!wordCount(answer) ||
			/^(?:n\/?a|none|not applicable|todo|tbd|fill (?:this )?in|your (?:answer|description) here)[.!]?$/i.test(answer)
		) {
			errors.push(`Answer "${title}" with actual content; explain why if it isn't applicable.`);
		}
	}

	const confirmation = sections.find((section) => section.name === 'confirmation');
	if (confirmation) {
		const checkboxes = readCheckboxes(confirmation.lines);
		for (const text of CONFIRMATIONS) {
			const matches = checkboxes.filter((item) => normalize(item.text) === normalize(text));
			if (matches.length !== 1 || !matches[0].checked) {
				errors.push(`Include and check this confirmation exactly once: "${text}"`);
			}
		}
	}

	const description = sections.find((section) => section.name === 'description');
	const descriptionWords = wordCount(description?.lines.map((line) => line.text).join('\n') ?? '');
	const bodyWords = sections.reduce(
		(count, section) =>
			count +
			(section.name === 'confirmation'
				? 0
				: wordCount(section.lines.map((line) => line.text).join('\n'))),
		0
	);
	if (descriptionWords > DESCRIPTION_WORD_LIMIT) {
		warnings.push(
			`Description is ${descriptionWords} words; aim for ${DESCRIPTION_WORD_LIMIT} or fewer.`
		);
	}
	if (bodyWords > BODY_WORD_LIMIT) {
		warnings.push(
			`PR body is ${bodyWords} words excluding confirmations; aim for ${BODY_WORD_LIMIT} or fewer.`
		);
	}
	return { errors, warnings, wordCounts: { description: descriptionWords, body: bodyWords } };
}

if (import.meta.main) {
	const path = Deno.args[0];
	if (!path) {
		console.error('Usage: deno run --allow-read scripts/check-pr-description.ts <body.md>');
		Deno.exit(1);
	}
	const result = validatePrDescription(await Deno.readTextFile(path));
	for (const message of result.errors) console.log(`::error title=PR description::${message}`);
	for (const message of result.warnings) console.log(`::warning title=PR description::${message}`);
	if (!result.errors.length) console.log('PR description meets the template requirements.');
	Deno.exit(result.errors.length ? 1 : 0);
}
