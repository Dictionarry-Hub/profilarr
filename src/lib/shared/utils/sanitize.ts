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

const SAFE_URL_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

/**
 * Decode HTML entities (numeric and named) so URL scheme checks
 * see the real characters, not encoded bypasses like &#x61;.
 */
function decodeEntities(str: string): string {
	const named: Record<string, string> = {
		'&amp;': '&',
		'&lt;': '<',
		'&gt;': '>',
		'&quot;': '"',
		'&#039;': "'",
		'&apos;': "'",
		'&nbsp;': ' ',
		'&tab;': '\t'
	};
	return str.replace(/&(?:#x([0-9a-f]+)|#(\d+)|[a-z]+);/gi, (m, hex, dec) => {
		if (hex) return String.fromCodePoint(parseInt(hex, 16));
		if (dec) return String.fromCodePoint(parseInt(dec, 10));
		return named[m.toLowerCase()] ?? m;
	});
}

/**
 * Check if a URL value is safe after decoding entities and stripping whitespace.
 * Rejects javascript:, vbscript:, data:, and any other non-allowlisted scheme.
 */
function isSafeUrl(raw: string): boolean {
	const decoded = decodeEntities(raw)
		// deno-lint-ignore no-control-regex
		.replace(/[\s\x00-\x1f]+/g, '')
		.toLowerCase();
	// Relative URLs and fragment-only URLs are safe
	if (!decoded.includes(':')) return true;
	return SAFE_URL_SCHEMES.has(decoded.slice(0, decoded.indexOf(':') + 1));
}

/**
 * HTML sanitizer — works in both server and client contexts.
 * Strips disallowed tags, attributes, event handlers, and dangerous URLs.
 */
export function sanitizeHtml(html: string): string {
	const allowedTags = new Set([
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
	]);

	const allowedAttrs: Record<string, Set<string>> = {
		a: new Set(['href', 'title']),
		img: new Set(['src', 'alt', 'title'])
	};

	// Remove script tags and their content
	html = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');

	// Remove event handlers
	html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');

	// Filter tags and attributes
	return html.replace(/<\/?([a-z][a-z0-9]*)\b([^>]*)>/gi, (match, tag, attrs) => {
		const lowerTag = tag.toLowerCase();

		if (!allowedTags.has(lowerTag)) {
			return '';
		}

		if (match.startsWith('</')) {
			return `</${lowerTag}>`;
		}

		const allowedForTag = allowedAttrs[lowerTag];
		if (!allowedForTag) {
			return `<${lowerTag}>`;
		}

		const filteredAttrs = attrs.replace(
			/([a-z][a-z0-9-]*)\s*=\s*["']([^"']*)["']/gi,
			(_attrMatch: string, attrName: string, attrValue: string) => {
				const lowerAttr = attrName.toLowerCase();
				if (!allowedForTag.has(lowerAttr)) return '';
				if ((lowerAttr === 'href' || lowerAttr === 'src') && !isSafeUrl(attrValue)) return '';
				return ` ${attrName}="${attrValue}"`;
			}
		);

		return `<${lowerTag}${filteredAttrs}>`;
	});
}
