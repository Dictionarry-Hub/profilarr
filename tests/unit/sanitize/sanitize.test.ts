/**
 * Tests for HTML sanitizer -- regression tests for bypass vectors from SA-06.
 *
 * Tests 1-3 cover the exact bypass techniques that the regex sanitizer missed.
 * Tests 4-8 cover basic allowlist behavior that should continue working.
 */

import { assertEquals } from '@std/assert';
import { sanitizeHtml } from '$shared/utils/sanitize.ts';

// --- SA-06 bypass vectors (entity-encoded / obfuscated javascript: URLs) ---

Deno.test('sanitizeHtml: strips entity-encoded javascript: in href', () => {
	// Browser decodes &#x61; to "a", making this "javascript:alert(1)".
	// A regex-only sanitizer misses this because the literal string "javascript:" isn't present.
	const input = '<a href="jav&#x61;script:alert(1)">click</a>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('href'), false, `Dangerous href survived sanitization -- ${result}`);
});

Deno.test('sanitizeHtml: strips case-varied javascript: in href', () => {
	const input = '<a href="JaVaScRiPt:alert(1)">click</a>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('href'), false, `Dangerous href survived sanitization -- ${result}`);
});

Deno.test('sanitizeHtml: strips whitespace-obfuscated javascript: in href', () => {
	// Browsers ignore whitespace inside URL schemes, so "java\nscript:" = "javascript:".
	// A regex-only sanitizer misses this because the literal match is broken by the newline.
	const input = '<a href="java\nscript:alert(1)">click</a>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('href'), false, `Dangerous href survived sanitization -- ${result}`);
});

// --- Basic sanitizer behavior ---

Deno.test('sanitizeHtml: preserves https href', () => {
	const input = '<a href="https://example.com">link</a>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('https://example.com'), true, `Output lost https href -- ${result}`);
});

Deno.test('sanitizeHtml: strips script tags', () => {
	const input = '<p>hello</p><script>alert(1)</script>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('<script'), false, `Output still contains script tag -- ${result}`);
	assertEquals(
		result.includes('alert(1)'),
		false,
		`Output still contains script body -- ${result}`
	);
});

Deno.test('sanitizeHtml: strips onerror event handler', () => {
	const input = '<img src="x" onerror="alert(1)">';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('onerror'), false, `Output still contains onerror -- ${result}`);
});

Deno.test('sanitizeHtml: preserves allowed tags', () => {
	const input = '<p>text</p><strong>bold</strong><em>italic</em><code>mono</code>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('<p>'), true);
	assertEquals(result.includes('<strong>'), true);
	assertEquals(result.includes('<em>'), true);
	assertEquals(result.includes('<code>'), true);
});

Deno.test('sanitizeHtml: strips disallowed tags', () => {
	const input = '<div>content</div><iframe src="evil"></iframe>';
	const result = sanitizeHtml(input);
	assertEquals(result.includes('<div'), false, `Output still contains div -- ${result}`);
	assertEquals(result.includes('<iframe'), false, `Output still contains iframe -- ${result}`);
});
