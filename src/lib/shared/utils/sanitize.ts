import createDOMPurify from 'dompurify';

/**
 * Escape HTML special characters to prevent XSS in template literals.
 */
export function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

const ALLOWED_TAGS = [
	'p',
	'br',
	'strong',
	'em',
	'u',
	'code',
	'pre',
	'blockquote',
	'ul',
	'ol',
	'li',
	'a',
	'img',
	'h1',
	'h2',
	'h3',
	'h4',
	'h5',
	'h6',
	'table',
	'thead',
	'tbody',
	'tr',
	'th',
	'td',
	'hr',
	'del',
	'ins'
];

const ALLOWED_ATTR = ['href', 'title', 'src', 'alt'];

// Initialize DOMPurify with the appropriate DOM implementation.
// Browser: native DOM. Server (Deno SSR / tests): jsdom.
// deno-lint-ignore no-explicit-any
let purifier: any;

if (typeof globalThis.document !== 'undefined') {
	purifier = createDOMPurify(globalThis.window);
} else {
	const { JSDOM } = await import(/* @vite-ignore */ 'jsdom');
	const dom = new JSDOM('');
	// deno-lint-ignore no-explicit-any
	purifier = createDOMPurify(dom.window as any);
}

/**
 * Sanitize HTML using DOMPurify. Safe against entity-encoded, case-varied,
 * and whitespace-obfuscated XSS vectors.
 */
export function sanitizeHtml(html: string): string {
	return purifier.sanitize(html, { ALLOWED_TAGS, ALLOWED_ATTR });
}
