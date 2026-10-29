/**
 * Tests for HTML sanitizer.
 *
 * Sections:
 * 1. SA-06 bypass vectors (entity-encoded / obfuscated javascript: URLs)
 * 2. Basic allowlist behavior
 * 3. Unquoted-attribute bypasses from the external report. Every payload is
 *    checked as raw HTML and again after `marked.parse()`, since both paths
 *    exist in the app.
 * 4. Other attribute families not covered by the report
 * 5. Markdown link syntax through `marked`
 * 6. Positive cases: allowed markup must survive unchanged
 */

import { expect, test } from 'vitest';
import { marked } from 'marked';
import { sanitizeHtml } from '#shared/utils/sanitize.ts';

// --- Helpers ---

/** True when any tag carries an on* attribute, quoted or not, space- or slash-separated. */
function hasEventHandler(html: string): boolean {
	return /<[a-z][^>]*[\s/]on[a-z]+\s*=/i.test(html);
}

/** True when any tag carries the named attribute. */
function hasAttr(html: string, attr: string): boolean {
	return new RegExp(`<[a-z][^>]*[\\s/]${attr}\\s*=`, 'i').test(html);
}

function assertNoHandler(result: string, input: string) {
	expect(
		hasEventHandler(result),
		`Event handler survived sanitization\n  input:  ${input}\n  output: ${result}`
	).toStrictEqual(false);
}

function assertNoAttr(result: string, attr: string, input: string) {
	expect(
		hasAttr(result, attr),
		`Attribute "${attr}" survived sanitization\n  input:  ${input}\n  output: ${result}`
	).toStrictEqual(false);
}

function viaMarked(input: string): string {
	return marked.parse(input) as string;
}

// --- SA-06 bypass vectors (entity-encoded / obfuscated javascript: URLs) ---

test('sanitizeHtml: strips entity-encoded javascript: in href', () => {
	// Browser decodes &#x61; to "a", making this "javascript:alert(1)".
	// A regex-only sanitizer misses this because the literal string "javascript:" isn't present.
	const input = '<a href="jav&#x61;script:alert(1)">click</a>';
	const result = sanitizeHtml(input);
	expect(
		result.includes('href'),
		`Dangerous href survived sanitization -- ${result}`
	).toStrictEqual(false);
});

test('sanitizeHtml: strips case-varied javascript: in href', () => {
	const input = '<a href="JaVaScRiPt:alert(1)">click</a>';
	const result = sanitizeHtml(input);
	expect(
		result.includes('href'),
		`Dangerous href survived sanitization -- ${result}`
	).toStrictEqual(false);
});

test('sanitizeHtml: strips whitespace-obfuscated javascript: in href', () => {
	// Browsers ignore whitespace inside URL schemes, so "java\nscript:" = "javascript:".
	// A regex-only sanitizer misses this because the literal match is broken by the newline.
	const input = '<a href="java\nscript:alert(1)">click</a>';
	const result = sanitizeHtml(input);
	expect(
		result.includes('href'),
		`Dangerous href survived sanitization -- ${result}`
	).toStrictEqual(false);
});

// --- Basic sanitizer behavior ---

test('sanitizeHtml: preserves https href', () => {
	const input = '<a href="https://example.com">link</a>';
	const result = sanitizeHtml(input);
	expect(
		result.includes('https://example.com'),
		`Output lost https href -- ${result}`
	).toStrictEqual(true);
});

test('sanitizeHtml: strips script tags', () => {
	const input = '<p>hello</p><script>alert(1)</script>';
	const result = sanitizeHtml(input);
	expect(result.includes('<script'), `Output still contains script tag -- ${result}`).toStrictEqual(
		false
	);
	expect(
		result.includes('alert(1)'),
		`Output still contains script body -- ${result}`
	).toStrictEqual(false);
});

test('sanitizeHtml: strips onerror event handler', () => {
	const input = '<img src="x" onerror="alert(1)">';
	const result = sanitizeHtml(input);
	expect(result.includes('onerror'), `Output still contains onerror -- ${result}`).toStrictEqual(
		false
	);
});

test('sanitizeHtml: preserves allowed tags', () => {
	const input = '<p>text</p><strong>bold</strong><em>italic</em><code>mono</code>';
	const result = sanitizeHtml(input);
	expect(result.includes('<p>')).toStrictEqual(true);
	expect(result.includes('<strong>')).toStrictEqual(true);
	expect(result.includes('<em>')).toStrictEqual(true);
	expect(result.includes('<code>')).toStrictEqual(true);
});

test('sanitizeHtml: unwraps links to text when links are disabled', () => {
	const input = 'Uses the <a href="https://dictionarry.dev/wiki/gppi"><strong>GPPI</strong></a>.';
	expect(sanitizeHtml(input, { links: false })).toStrictEqual('Uses the <strong>GPPI</strong>.');
	const kept = sanitizeHtml(input);
	expect(kept.includes('href="https://dictionarry.dev/wiki/gppi"'), kept).toStrictEqual(true);
});

test('sanitizeHtml: strips disallowed tags', () => {
	const input = '<div>content</div><iframe src="evil"></iframe>';
	const result = sanitizeHtml(input);
	expect(result.includes('<div'), `Output still contains div -- ${result}`).toStrictEqual(false);
	expect(result.includes('<iframe'), `Output still contains iframe -- ${result}`).toStrictEqual(
		false
	);
});

// --- Unquoted-attribute bypasses from the external report ---
//
// The report's surviving payloads. Each is tested as raw HTML (the quality
// profile path passes stored HTML straight to sanitizeHtml) and through
// marked.parse() (every other call site).

const reportPayloads: Array<{ name: string; input: string }> = [
	{ name: 'unquoted onerror', input: '<img src=x onerror=alert(1)>' },
	{ name: 'unquoted onerror with window marker', input: '<img src=x onerror=window.xssFired++>' },
	{ name: 'slash-separated svg onload', input: '<svg/onload=alert(1)>' },
	{ name: 'unclosed img tag', input: '<img src=x onerror=alert(1)//' },
	{ name: 'src with colon', input: '<img src=x:x onerror=alert(1)>' },
	{ name: 'space before equals', input: '<img src=x onerror =alert(1)>' },
	{ name: 'mixed-case handler name', input: '<img src=x OnErRoR=alert(1)>' },
	{
		name: 'noscript title smuggling',
		input: '<noscript><p title="</noscript><img src=x onerror=alert(1)>">'
	},
	{ name: 'xmp wrapper', input: '<xmp><img src=x onerror=alert(1)></xmp>' },
	{ name: 'title wrapper', input: '<title><img src=x onerror=alert(1)></title>' },
	{ name: 'textarea wrapper', input: '<textarea><img src=x onerror=alert(1)></textarea>' },
	{ name: 'quote-and-bracket prefix', input: '"><img src=x onerror=alert(1)>' },
	{ name: 'self-closing img', input: '<img src=x:x onerror=alert(1) />' },
	{ name: 'slash-separated attributes', input: '<img/src="x"/onerror=alert(1)>' },
	{ name: 'entity-encoded parentheses', input: '<img src=x onerror=alert&lpar;1&rpar;>' }
];

for (const { name, input } of reportPayloads) {
	test(`sanitizeHtml: report: ${name} (direct)`, () => {
		assertNoHandler(sanitizeHtml(input), input);
	});
	test(`sanitizeHtml: report: ${name} (via marked)`, () => {
		assertNoHandler(sanitizeHtml(viaMarked(input)), input);
	});
}

// --- Other attribute families not covered by the report ---

const handlerVariants: Array<{ name: string; input: string }> = [
	{ name: 'quoted src with unquoted handler', input: '<img src="x" onerror=alert(1)>' },
	{
		name: 'allowed quoted href with unquoted onclick',
		input: '<a href="https://ok.example" onclick=alert(1)>x</a>'
	},
	{ name: 'handler before allowed attribute', input: '<img onerror=alert(1) src=x alt=y>' },
	{ name: 'newline-separated attributes', input: '<img\nsrc=x\nonerror=alert(1)>' },
	{ name: 'tab-separated attributes', input: '<img\tsrc=x\tonerror=alert(1)>' },
	{ name: 'uppercase tag and attributes', input: '<IMG SRC=x ONERROR=alert(1)>' },
	{ name: 'trailing space before close', input: '<img src=x onerror=alert(1) >' },
	{
		name: 'handler on allowed link',
		input: '<a href=https://ok.example onmouseover=alert(1)>x</a>'
	},
	{
		name: 'abruptly closed comment then img',
		input: '<!--><img src=x onerror=alert(1)>-->'
	},
	{ name: 'handler inside allowed block', input: '<p><img src=x onerror=alert(1)></p>' },
	{
		name: 'handler inside allowed table cell',
		input: '<table><tr><td><img src=x onerror=alert(1)></td></tr></table>'
	}
];

for (const { name, input } of handlerVariants) {
	test(`sanitizeHtml: handler variant: ${name} (direct)`, () => {
		assertNoHandler(sanitizeHtml(input), input);
	});
	test(`sanitizeHtml: handler variant: ${name} (via marked)`, () => {
		assertNoHandler(sanitizeHtml(viaMarked(input)), input);
	});
}

const dangerousUrls: Array<{ name: string; input: string }> = [
	{ name: 'unquoted javascript: href', input: '<a href=javascript:alert(1)>x</a>' },
	{ name: 'unquoted mixed-case javascript: href', input: '<a href=JaVaScRiPt:alert(1)>x</a>' },
	{ name: 'unquoted entity-obfuscated href', input: '<a href=jav&#x61;script:alert(1)>x</a>' },
	{ name: 'unquoted vbscript: href', input: '<a href=vbscript:msgbox(1)>x</a>' },
	{ name: 'unquoted data: href', input: '<a href=data:text/html,x>x</a>' },
	{ name: 'single-quoted javascript: href', input: "<a href='javascript:alert(1)'>x</a>" },
	{ name: 'unquoted javascript: src', input: '<img src=javascript:alert(1)>' }
];

for (const { name, input } of dangerousUrls) {
	const attr = input.startsWith('<img') ? 'src' : 'href';
	test(`sanitizeHtml: dangerous url: ${name} (direct)`, () => {
		assertNoAttr(sanitizeHtml(input), attr, input);
	});
	test(`sanitizeHtml: dangerous url: ${name} (via marked)`, () => {
		assertNoAttr(sanitizeHtml(viaMarked(input)), attr, input);
	});
}

const disallowedAttrs: Array<{ name: string; input: string; attr: string }> = [
	{ name: 'unquoted style on img', input: '<img src=x style=color:red>', attr: 'style' },
	{
		name: 'unquoted data attribute on link',
		input: '<a href=https://x.example data-foo=bar>x</a>',
		attr: 'data-foo'
	},
	{ name: 'unquoted id on img', input: '<img src=x id=clobber>', attr: 'id' },
	{
		name: 'unquoted target on link',
		input: '<a href=https://x.example target=_top>x</a>',
		attr: 'target'
	},
	{ name: 'unquoted srcset on img', input: '<img src=x srcset=y>', attr: 'srcset' }
];

for (const { name, input, attr } of disallowedAttrs) {
	test(`sanitizeHtml: disallowed attribute: ${name} (direct)`, () => {
		assertNoAttr(sanitizeHtml(input), attr, input);
	});
	test(`sanitizeHtml: disallowed attribute: ${name} (via marked)`, () => {
		assertNoAttr(sanitizeHtml(viaMarked(input)), attr, input);
	});
}

test('sanitizeHtml: unquoted handler is dropped when links are disabled', () => {
	const input = '<a href=https://ok.example onclick=alert(1)>x</a><img src=x onerror=alert(1)>';
	const result = sanitizeHtml(input, { links: false });
	assertNoHandler(result, input);
	expect(result.includes('<a'), result).toStrictEqual(false);
});

test('sanitizeHtml: disallowed tag with unquoted handler is removed entirely', () => {
	const input = '<details open ontoggle=alert(1)>x</details>';
	const result = sanitizeHtml(input);
	expect(result.includes('<details'), result).toStrictEqual(false);
	assertNoHandler(result, input);
});

// --- Markdown link syntax through marked ---

test('sanitizeHtml: markdown link with javascript: href is stripped', () => {
	const result = sanitizeHtml(viaMarked('[click](javascript:alert(1))'));
	assertNoAttr(result, 'href', '[click](javascript:alert(1))');
	expect(result.includes('click'), result).toStrictEqual(true);
});

test('sanitizeHtml: markdown image with javascript: src is stripped', () => {
	const result = sanitizeHtml(viaMarked('![x](javascript:alert(1))'));
	assertNoAttr(result, 'src', '![x](javascript:alert(1))');
});

test('sanitizeHtml: raw img inside markdown paragraph loses unquoted handler', () => {
	const input = 'Benign text <img src=x onerror=window.xssFired++> more text';
	const result = sanitizeHtml(viaMarked(input));
	assertNoHandler(result, input);
	expect(result.includes('Benign text'), result).toStrictEqual(true);
});

// --- Positive cases: allowed markup must survive ---

test('sanitizeHtml: keeps href and title on links', () => {
	const result = sanitizeHtml('<a href="https://example.com/a" title="Example">x</a>');
	expect(result.includes('href="https://example.com/a"'), result).toStrictEqual(true);
	expect(result.includes('title="Example"'), result).toStrictEqual(true);
});

test('sanitizeHtml: keeps src, alt and title on images', () => {
	const result = sanitizeHtml('<img src="https://example.com/i.png" alt="An image" title="T">');
	expect(result.includes('src="https://example.com/i.png"'), result).toStrictEqual(true);
	expect(result.includes('alt="An image"'), result).toStrictEqual(true);
	expect(result.includes('title="T"'), result).toStrictEqual(true);
});

test('sanitizeHtml: keeps relative, fragment and mailto hrefs', () => {
	for (const href of ['/docs/page', '#section', 'mailto:someone@example.com']) {
		const result = sanitizeHtml(`<a href="${href}">x</a>`);
		expect(result.includes(`href="${href}"`), result).toStrictEqual(true);
	}
});

test('sanitizeHtml: keeps allowed structural tags from marked output', () => {
	const md = '# Title\n\n- item **bold** `code`\n\n> quote\n\n| a | b |\n|---|---|\n| 1 | 2 |';
	const result = sanitizeHtml(viaMarked(md));
	for (const tag of [
		'<h1>',
		'<ul>',
		'<li>',
		'<strong>',
		'<code>',
		'<blockquote>',
		'<table>',
		'<td>'
	]) {
		expect(result.includes(tag), `Missing ${tag} -- ${result}`).toStrictEqual(true);
	}
});

test('sanitizeHtml: escaped text that looks like a tag stays escaped', () => {
	const result = sanitizeHtml('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
	expect(result).toStrictEqual('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
});
