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

/**
 * Simple HTML sanitizer — works in both server and client contexts.
 * Strips disallowed tags, attributes, event handlers, and javascript: URLs.
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

	// Remove event handlers and javascript: URLs
	html = html.replace(/\s*on\w+\s*=\s*["'][^"']*["']/gi, '');
	html = html.replace(/href\s*=\s*["']javascript:[^"']*["']/gi, '');

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
			(attrMatch: string, attrName: string, attrValue: string) => {
				if (allowedForTag.has(attrName.toLowerCase())) {
					return ` ${attrName}="${attrValue}"`;
				}
				return '';
			}
		);

		return `<${lowerTag}${filteredAttrs}>`;
	});
}
