/**
 * Parse `${pcdPath}/announcements/*.md` files into structured records.
 *
 * Each file has YAML frontmatter (between `---` delimiters at the top) and
 * a markdown body below. The id is derived from the filename (without the
 * `.md` extension), so filesystem uniqueness rules guarantee id uniqueness.
 *
 * Failures are isolated per file: a malformed file produces a `ParseError`
 * but does not abort the rest. The caller (the reconcile service) logs
 * errors and proceeds with the parsed entries.
 */

import { parse as parseYaml } from 'yaml';
import type { AnnouncementSeverity, DatabaseAnnouncementParsed } from './types.ts';

const ANNOUNCEMENTS_SUBDIR = 'announcements';
const SEVERITIES: readonly AnnouncementSeverity[] = ['info', 'warning', 'critical'];

export interface ParseError {
	filename: string;
	reason: string;
}

export interface ParseResult {
	parsed: DatabaseAnnouncementParsed[];
	errors: ParseError[];
}

/**
 * Read every `.md` file directly under `${pcdPath}/announcements/`, parse
 * each, and return the successful records plus per-file errors. Missing
 * directories return an empty result without an error (a PCD repo without
 * announcements is normal).
 */
export async function parseAnnouncementsDir(pcdPath: string): Promise<ParseResult> {
	const dir = `${pcdPath}/${ANNOUNCEMENTS_SUBDIR}`;

	let entries: Deno.DirEntry[];
	try {
		entries = await collectDirEntries(dir);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			return { parsed: [], errors: [] };
		}
		throw error;
	}

	const parsed: DatabaseAnnouncementParsed[] = [];
	const errors: ParseError[] = [];

	for (const entry of entries) {
		if (!entry.isFile) continue;
		if (!entry.name.endsWith('.md')) continue;

		const path = `${dir}/${entry.name}`;
		try {
			const content = await Deno.readTextFile(path);
			const result = parseFile(entry.name, content);
			if ('error' in result) {
				errors.push({ filename: entry.name, reason: result.error });
			} else {
				parsed.push(result.parsed);
			}
		} catch (error) {
			errors.push({ filename: entry.name, reason: describe(error) });
		}
	}

	return { parsed, errors };
}

/**
 * Parse a single announcement file by id. Returns the parsed entry on
 * success, a `ParseError` for a known parse failure, or `null` if the
 * file does not exist.
 */
export async function parseAnnouncementFile(
	pcdPath: string,
	id: string
): Promise<DatabaseAnnouncementParsed | ParseError | null> {
	const filename = `${id}.md`;
	const path = `${pcdPath}/${ANNOUNCEMENTS_SUBDIR}/${filename}`;

	let content: string;
	try {
		content = await Deno.readTextFile(path);
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) return null;
		return { filename, reason: describe(error) };
	}

	const result = parseFile(filename, content);
	if ('error' in result) {
		return { filename, reason: result.error };
	}
	return result.parsed;
}

async function collectDirEntries(dir: string): Promise<Deno.DirEntry[]> {
	const out: Deno.DirEntry[] = [];
	for await (const entry of Deno.readDir(dir)) {
		out.push(entry);
	}
	return out;
}

function parseFile(
	filename: string,
	content: string
): { parsed: DatabaseAnnouncementParsed } | { error: string } {
	const split = splitFrontmatter(content);
	if (!split) {
		return { error: 'Missing or unterminated YAML frontmatter' };
	}

	let raw: unknown;
	try {
		raw = parseYaml(split.yaml);
	} catch (error) {
		return { error: `YAML parse error: ${describe(error)}` };
	}

	const validated = validateFrontmatter(raw);
	if ('error' in validated) {
		return { error: validated.error };
	}

	const id = filename.slice(0, -'.md'.length);
	return {
		parsed: {
			id,
			title: validated.frontmatter.title,
			severity: validated.frontmatter.severity,
			published_at: validated.frontmatter.published_at,
			expires_at: validated.frontmatter.expires_at,
			link: validated.frontmatter.link,
			body: split.body
		}
	};
}

interface FrontmatterShape {
	title: string;
	severity: AnnouncementSeverity;
	published_at: string;
	expires_at: string | null;
	link: string | null;
}

function validateFrontmatter(raw: unknown): { frontmatter: FrontmatterShape } | { error: string } {
	if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
		return { error: 'Frontmatter must be a YAML mapping' };
	}
	const obj = raw as Record<string, unknown>;

	const title = obj.title;
	if (typeof title !== 'string' || title.trim() === '') {
		return { error: 'Field `title` is required and must be a non-empty string' };
	}

	const severity = obj.severity;
	if (typeof severity !== 'string' || !SEVERITIES.includes(severity as AnnouncementSeverity)) {
		return {
			error: `Field \`severity\` is required and must be one of: ${SEVERITIES.join(', ')}`
		};
	}

	const publishedAt = normalizeDate(obj.published_at);
	if (publishedAt === null) {
		return { error: 'Field `published_at` is required and must be an ISO-8601 timestamp' };
	}

	const expiresAt = obj.expires_at === undefined ? null : normalizeDate(obj.expires_at);
	if (obj.expires_at !== undefined && expiresAt === null) {
		return { error: 'Field `expires_at`, when present, must be an ISO-8601 timestamp' };
	}

	let link: string | null;
	if (obj.link === undefined || obj.link === null) {
		link = null;
	} else if (typeof obj.link === 'string') {
		link = obj.link;
	} else {
		return { error: 'Field `link`, when present, must be a string' };
	}

	return {
		frontmatter: {
			title,
			severity: severity as AnnouncementSeverity,
			published_at: publishedAt,
			expires_at: expiresAt,
			link
		}
	};
}

/**
 * Accept either a string already in ISO format, or a `Date` (which YAML
 * parses bare timestamps into). Return canonical ISO-8601 string, or null
 * if the value can't be interpreted as a date.
 */
function normalizeDate(value: unknown): string | null {
	if (value instanceof Date) {
		const iso = value.toISOString();
		return Number.isNaN(value.getTime()) ? null : iso;
	}
	if (typeof value === 'string') {
		const parsed = Date.parse(value);
		if (Number.isNaN(parsed)) return null;
		return value;
	}
	return null;
}

/**
 * Split a file into YAML frontmatter and markdown body.
 *
 * Returns null if the file does not start with a `---` line or if the
 * closing `---` cannot be found. One optional blank line immediately after
 * the closing `---` is consumed (frontmatter convention).
 */
function splitFrontmatter(content: string): { yaml: string; body: string } | null {
	const lines = content.split(/\r?\n/);
	if (lines.length === 0 || lines[0] !== '---') return null;

	let closingIndex = -1;
	for (let i = 1; i < lines.length; i++) {
		if (lines[i] === '---') {
			closingIndex = i;
			break;
		}
	}
	if (closingIndex === -1) return null;

	const yaml = lines.slice(1, closingIndex).join('\n');
	let bodyLines = lines.slice(closingIndex + 1);
	if (bodyLines.length > 0 && bodyLines[0] === '') {
		bodyLines = bodyLines.slice(1);
	}
	return { yaml, body: bodyLines.join('\n') };
}

function describe(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
