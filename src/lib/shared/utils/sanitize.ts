/**
 * HTML escaping and the output filter for rendered markdown.
 *
 * `renderMarkdown()` in `./markdown.ts` is the only producer of HTML shown
 * through `{@html}`. It escapes raw HTML at the markdown layer, so under
 * normal operation `sanitizeHtml()` sees only tags that `marked` generated.
 * The filter is a second layer: it rebuilds every tag from parsed, allowlisted
 * attributes and never copies source attribute text through, so a change in
 * `marked` cannot quietly reopen the page to author-written markup.
 */

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
export function isSafeUrl(raw: string): boolean {
	const decoded = decodeEntities(raw)
		// eslint-disable-next-line no-control-regex -- strips control characters on purpose
		.replace(/[\s\x00-\x1f]+/g, '')
		.toLowerCase();
	// Relative URLs and fragment-only URLs are safe
	if (!decoded.includes(':')) return true;
	return SAFE_URL_SCHEMES.has(decoded.slice(0, decoded.indexOf(':') + 1));
}

/** Tags `marked` generates from markdown syntax. Nothing else is kept. */
const ALLOWED_TAGS = new Set([
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

const ALLOWED_TAGS_WITHOUT_LINKS = new Set([...ALLOWED_TAGS].filter((tag) => tag !== 'a'));

const ALLOWED_ATTRS: Record<string, Set<string>> = {
	a: new Set(['href', 'title']),
	img: new Set(['src', 'alt', 'title'])
};

const URL_ATTRS = new Set(['href', 'src']);

const VOID_TAGS = new Set(['br', 'hr', 'img']);

/**
 * Elements whose content a browser reads as raw text or script rather than
 * markup. Dropping only the tag would surface the content as visible text,
 * so the content goes with it.
 */
const RAW_TEXT_TAGS = new Set([
	'script',
	'style',
	'textarea',
	'title',
	'xmp',
	'noscript',
	'iframe',
	'noembed',
	'noframes',
	'plaintext'
]);

// Sticky regexes: each is anchored at `lastIndex`, so the tag parser walks the
// input without slicing.
const TAG_NAME = /[a-zA-Z][a-zA-Z0-9]*/y;
const ATTR_SEPARATOR = /[\s/]+/y;
const ATTR_NAME = /[^\s"'<>/=]+/y;
const ATTR_EQUALS = /\s*=\s*/y;
const ATTR_VALUE_DOUBLE = /"([^"]*)"/y;
const ATTR_VALUE_SINGLE = /'([^']*)'/y;
const ATTR_VALUE_UNQUOTED = /[^\s"'=<>`]+/y;

interface ParsedAttr {
	name: string;
	value: string | null;
}

interface ParsedTag {
	name: string;
	closing: boolean;
	attrs: ParsedAttr[];
	/** Index just past the closing `>`. */
	end: number;
}

/**
 * Parse the tag that starts at `html[start] === '<'`.
 *
 * Accepts the attribute forms a browser accepts: double-quoted, single-quoted,
 * unquoted and valueless, separated by whitespace or slashes. Returns null for
 * anything that is not a complete, well-formed tag (comments, doctypes,
 * processing instructions, an unclosed tag, junk after the name); the caller
 * then escapes the `<` so the browser cannot read it differently.
 */
function parseTag(html: string, start: number): ParsedTag | null {
	let i = start + 1;
	const closing = html[i] === '/';
	if (closing) i++;

	TAG_NAME.lastIndex = i;
	const nameMatch = TAG_NAME.exec(html);
	if (!nameMatch) return null;
	const name = nameMatch[0].toLowerCase();
	i = TAG_NAME.lastIndex;

	const attrs: ParsedAttr[] = [];
	while (true) {
		ATTR_SEPARATOR.lastIndex = i;
		const separator = ATTR_SEPARATOR.exec(html);
		if (separator) i = ATTR_SEPARATOR.lastIndex;

		if (i >= html.length) return null;
		if (html[i] === '>') return { name, closing, attrs, end: i + 1 };
		if (!separator) return null;

		ATTR_NAME.lastIndex = i;
		const attrName = ATTR_NAME.exec(html);
		if (!attrName) return null;
		i = ATTR_NAME.lastIndex;

		let value: string | null = null;
		ATTR_EQUALS.lastIndex = i;
		if (ATTR_EQUALS.exec(html)) {
			i = ATTR_EQUALS.lastIndex;
			for (const pattern of [ATTR_VALUE_DOUBLE, ATTR_VALUE_SINGLE, ATTR_VALUE_UNQUOTED]) {
				pattern.lastIndex = i;
				const match = pattern.exec(html);
				if (match) {
					value = match[1] ?? match[0];
					i = pattern.lastIndex;
					break;
				}
			}
			if (value === null) return null;
		}

		attrs.push({ name: attrName[0].toLowerCase(), value });
	}
}

/** Rebuild an allowed opening tag from its allowlisted attributes only. */
function serializeTag(tag: ParsedTag): string {
	const allowedAttrs = ALLOWED_ATTRS[tag.name];
	let attrs = '';
	if (allowedAttrs) {
		const seen = new Set<string>();
		for (const { name, value } of tag.attrs) {
			if (value === null || seen.has(name) || !allowedAttrs.has(name)) continue;
			const decoded = decodeEntities(value);
			if (URL_ATTRS.has(name) && !isSafeUrl(decoded)) continue;
			seen.add(name);
			attrs += ` ${name}="${escapeHtml(decoded)}"`;
		}
	}
	return `<${tag.name}${attrs}>`;
}

/** Index just past the closing tag for a raw-text element, or the end of input. */
function skipRawText(html: string, name: string, from: number): number {
	const lower = html.toLowerCase();
	const marker = `</${name}`;
	let at = lower.indexOf(marker, from);
	while (at !== -1) {
		let i = at + marker.length;
		while (i < html.length && /\s/.test(html[i])) i++;
		if (html[i] === '>') return i + 1;
		at = lower.indexOf(marker, at + 1);
	}
	return html.length;
}

/**
 * Output filter for rendered markdown. Works in both server and browser.
 *
 * Every `<` either starts a well-formed tag or is escaped. Allowed tags are
 * rebuilt from parsed attributes; everything else is dropped. Text between
 * tags is left as-is, since `marked` has already escaped it.
 *
 * `links: false` unwraps links to plain text, for content shown inside an
 * element that is itself a link (nested links break server-rendered HTML).
 */
export function sanitizeHtml(html: string, options: { links?: boolean } = {}): string {
	const allowedTags = options.links === false ? ALLOWED_TAGS_WITHOUT_LINKS : ALLOWED_TAGS;
	let out = '';
	let i = 0;

	while (i < html.length) {
		const lt = html.indexOf('<', i);
		if (lt === -1) {
			out += html.slice(i);
			break;
		}
		out += html.slice(i, lt);

		const tag = parseTag(html, lt);
		if (!tag) {
			out += '&lt;';
			i = lt + 1;
			continue;
		}
		i = tag.end;

		if (!allowedTags.has(tag.name)) {
			if (!tag.closing && RAW_TEXT_TAGS.has(tag.name)) {
				i = skipRawText(html, tag.name, i);
			}
			continue;
		}

		if (tag.closing) {
			if (!VOID_TAGS.has(tag.name)) out += `</${tag.name}>`;
			continue;
		}

		out += serializeTag(tag);
	}

	return out;
}
