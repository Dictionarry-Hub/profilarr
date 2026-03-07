/**
 * Markdown utility for parsing markdown to HTML
 */

import { marked } from 'marked';
import { sanitizeHtml } from '$shared/utils/sanitize.ts';

/**
 * Parse markdown to sanitized HTML
 */
export function parseMarkdown(markdown: string | null | undefined): string {
	if (!markdown) return '';

	// Parse markdown to HTML
	const html = marked.parse(markdown) as string;

	// Sanitize HTML to prevent XSS
	return sanitizeHtml(html);
}

/**
 * Strip markdown formatting and return plain text
 */
export function stripMarkdown(markdown: string | null | undefined): string {
	if (!markdown) return '';

	const html = parseMarkdown(markdown);
	return html.replace(/<[^>]*>/g, '').trim();
}
