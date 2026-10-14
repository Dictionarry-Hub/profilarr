/**
 * The one markdown renderer. Every description, announcement body and preview
 * goes through `renderMarkdown()`, on the server and in the browser.
 *
 * Descriptions are markdown only. Raw HTML in the source is escaped and shown
 * as text, link and image URLs must use an allowed scheme, and the result is
 * passed through `sanitizeHtml()` as a second layer.
 */

import { Marked, type Tokens } from 'marked';
import { escapeHtml, isSafeUrl, sanitizeHtml } from './sanitize.ts';

export interface RenderMarkdownOptions {
	/** Render inline markdown only, with no block wrapper. */
	inline?: boolean;
	/** `false` turns links into plain text, for content inside an element that is itself a link. */
	links?: boolean;
}

function createEngine(links: boolean): Marked {
	return new Marked({
		gfm: true,
		renderer: {
			// Raw HTML, block or inline, becomes visible text.
			html({ text }: Tokens.HTML | Tokens.Tag): string {
				return escapeHtml(text);
			},
			link({ href, title, tokens }: Tokens.Link): string {
				const text = this.parser.parseInline(tokens) as string;
				if (!links || !isSafeUrl(href)) return text;
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				return `<a href="${escapeHtml(href)}"${titleAttr}>${text}</a>`;
			},
			image({ href, title, text }: Tokens.Image): string {
				if (!isSafeUrl(href)) return escapeHtml(text);
				const titleAttr = title ? ` title="${escapeHtml(title)}"` : '';
				return `<img src="${escapeHtml(href)}" alt="${escapeHtml(text)}"${titleAttr}>`;
			}
		}
	});
}

const withLinks = createEngine(true);
const withoutLinks = createEngine(false);

/**
 * Render markdown to HTML that is safe to place in `{@html}`.
 */
export function renderMarkdown(
	text: string | null | undefined,
	options: RenderMarkdownOptions = {}
): string {
	if (!text) return '';
	const links = options.links !== false;
	const engine = links ? withLinks : withoutLinks;
	const html = (options.inline ? engine.parseInline(text) : engine.parse(text)) as string;
	return sanitizeHtml(html, { links });
}
