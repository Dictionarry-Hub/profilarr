/**
 * Tests for the shared markdown renderer.
 *
 * Descriptions are markdown only. Raw HTML must come out as visible text,
 * link and image URLs must use an allowed scheme, and ordinary markdown must
 * keep rendering as before.
 */

import { test } from 'vitest';
import { assertEquals, assertMatch, assertNotMatch } from '@std/assert';
import { renderMarkdown } from '$shared/utils/markdown.ts';

const PAYLOAD = '<img src=x onerror=window.xssFired++>';
const ESCAPED_PAYLOAD = '&lt;img src=x onerror=window.xssFired++&gt;';

// --- Raw HTML becomes text ---

test('renderMarkdown: raw HTML on its own line is escaped', () => {
	const result = renderMarkdown(PAYLOAD);
	assertEquals(result.includes(ESCAPED_PAYLOAD), true, result);
	assertNotMatch(result, /<img/);
});

test('renderMarkdown: raw HTML inside a paragraph is escaped', () => {
	const result = renderMarkdown(`Benign intro ${PAYLOAD} trailing text`);
	assertEquals(result, `<p>Benign intro ${ESCAPED_PAYLOAD} trailing text</p>\n`);
});

test('renderMarkdown: raw HTML in inline mode is escaped', () => {
	const result = renderMarkdown(`Benign intro ${PAYLOAD} trailing text`, { inline: true });
	assertEquals(result, `Benign intro ${ESCAPED_PAYLOAD} trailing text`);
});

test('renderMarkdown: harmless raw tags are escaped too, markdown only', () => {
	const result = renderMarkdown('some <b>bold</b> text<br>next');
	assertEquals(result, '<p>some &lt;b&gt;bold&lt;/b&gt; text&lt;br&gt;next</p>\n');
});

test('renderMarkdown: quoted handlers and script blocks are escaped', () => {
	for (const input of [
		'<img src="x" onerror="alert(1)">',
		'<script>alert(1)</script>',
		'<a href="https://ok.example" onclick="alert(1)">x</a>',
		'<svg/onload=alert(1)>',
		'<details open ontoggle=alert(1)>x</details>'
	]) {
		const result = renderMarkdown(input);
		assertNotMatch(result, /<[a-z][^>]*[\s/]on[a-z]+\s*=/i, `${input} -> ${result}`);
		assertNotMatch(result, /<(script|svg|details)/i, `${input} -> ${result}`);
	}
});

test('renderMarkdown: angle brackets in prose are escaped', () => {
	assertEquals(renderMarkdown('a < b > c'), '<p>a &lt; b &gt; c</p>\n');
});

// --- Link and image URLs ---

test('renderMarkdown: javascript: link keeps the text and drops the link', () => {
	assertEquals(renderMarkdown('[click](javascript:alert(1))'), '<p>click</p>\n');
});

test('renderMarkdown: obfuscated javascript: link is dropped', () => {
	for (const href of [
		'JaVaScRiPt:alert(1)',
		'java\tscript:alert(1)',
		'vbscript:msgbox(1)',
		'data:text/html,x'
	]) {
		const result = renderMarkdown(`[click](${href})`);
		assertNotMatch(result, /<a/, `${href} -> ${result}`);
		assertEquals(result.includes('click'), true, result);
	}
});

test('renderMarkdown: https link is kept with its title', () => {
	assertEquals(
		renderMarkdown('[ok](https://example.com/a "Title")'),
		'<p><a href="https://example.com/a" title="Title">ok</a></p>\n'
	);
});

test('renderMarkdown: relative, fragment and mailto links are kept', () => {
	for (const href of ['/docs/page', '#section', 'mailto:someone@example.com']) {
		const result = renderMarkdown(`[x](${href})`);
		assertEquals(result.includes(`href="${href}"`), true, result);
	}
});

test('renderMarkdown: bare GFM autolink becomes a link', () => {
	const result = renderMarkdown('see https://example.com now');
	assertEquals(
		result.includes('<a href="https://example.com">https://example.com</a>'),
		true,
		result
	);
});

test('renderMarkdown: links false unwraps every link to text', () => {
	const result = renderMarkdown('Uses the [**GPPI**](https://dictionarry.dev/wiki/gppi).', {
		links: false
	});
	assertEquals(result, '<p>Uses the <strong>GPPI</strong>.</p>\n');
});

test('renderMarkdown: javascript: image keeps the alt text and drops the image', () => {
	assertEquals(renderMarkdown('![alt text](javascript:alert(1))'), '<p>alt text</p>\n');
});

test('renderMarkdown: https image is kept with alt and title', () => {
	assertEquals(
		renderMarkdown('![An image](https://example.com/i.png "T")'),
		'<p><img src="https://example.com/i.png" alt="An image" title="T"></p>\n'
	);
});

test('renderMarkdown: quotes in link text and titles are escaped', () => {
	const result = renderMarkdown('[a "b"](https://example.com "say \\"hi\\"")');
	assertEquals(result.includes('title="say &quot;hi&quot;"'), true, result);
	assertNotMatch(result, /title="[^"]*"[^>]*"/);
});

// --- Ordinary markdown still renders ---

test('renderMarkdown: GFM features render', () => {
	const md = [
		'# Title',
		'',
		'- item **bold** `code` ~~gone~~',
		'',
		'> quote',
		'',
		'| a | b |',
		'|---|---|',
		'| 1 | 2 |',
		'',
		'```',
		'<not a tag>',
		'```'
	].join('\n');
	const result = renderMarkdown(md);
	for (const tag of [
		'<h1>',
		'<ul>',
		'<li>',
		'<strong>',
		'<code>',
		'<del>',
		'<blockquote>',
		'<table>',
		'<td>',
		'<pre>'
	]) {
		assertEquals(result.includes(tag), true, `Missing ${tag} -- ${result}`);
	}
	assertEquals(result.includes('&lt;not a tag&gt;'), true, result);
});

test('renderMarkdown: inline mode renders without a paragraph', () => {
	assertEquals(
		renderMarkdown('some **bold** text', { inline: true }),
		'some <strong>bold</strong> text'
	);
});

test('renderMarkdown: empty input renders nothing', () => {
	assertEquals(renderMarkdown(''), '');
	assertEquals(renderMarkdown(null), '');
	assertEquals(renderMarkdown(undefined), '');
});

test('renderMarkdown: output never carries an event handler for report payloads', () => {
	const payloads = [
		'<img src=x onerror=alert(1)>',
		'<img src=x onerror =alert(1)>',
		'<img src=x OnErRoR=alert(1)>',
		'<img src=x:x onerror=alert(1) />',
		'<img/src="x"/onerror=alert(1)>',
		'<img src=x onerror=alert&lpar;1&rpar;>',
		'<noscript><p title="</noscript><img src=x onerror=alert(1)>">',
		'<xmp><img src=x onerror=alert(1)></xmp>',
		'<textarea><img src=x onerror=alert(1)></textarea>',
		'"><img src=x onerror=alert(1)>',
		'<!--><img src=x onerror=alert(1)>-->'
	];
	for (const input of payloads) {
		for (const inline of [false, true]) {
			const result = renderMarkdown(input, { inline });
			assertMatch(result, /&lt;/, `${input} (inline=${inline}) -> ${result}`);
			assertNotMatch(
				result,
				/<[a-z][^>]*[\s/]on[a-z]+\s*=/i,
				`${input} (inline=${inline}) -> ${result}`
			);
		}
	}
});
