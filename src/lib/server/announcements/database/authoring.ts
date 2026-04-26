/**
 * Filesystem helpers for the maintainer authoring UI.
 *
 * Writes a single `announcements/<ulid>.md` file at a time, atomically.
 * No DB access here; the maintainer's authoring flow updates the working
 * copy, and the next reconcile pass (manual pull, scheduled sync, or the
 * authoring save action triggering it directly) syncs the change into the
 * database_announcements table.
 *
 * Mirrors the readme/manifest editing pattern: the form action writes to
 * disk, git commit/push happens via the existing PCD git flow.
 */

import { stringify as stringifyYaml } from 'yaml';
import { generateUlid } from '$shared/utils/ulid.ts';
import type { AnnouncementSeverity } from './types.ts';

const ANNOUNCEMENTS_SUBDIR = 'announcements';

export interface AnnouncementFileInput {
	title: string;
	severity: AnnouncementSeverity;
	publishedAt: string;
	expiresAt: string | null;
	link: string | null;
	body: string;
}

/** Returns a fresh 26-character ULID suitable for use as an announcement id. */
export function generateAnnouncementId(): string {
	return generateUlid();
}

/**
 * Write `announcements/<id>.md` under the PCD path with the given content,
 * atomically. Creates the announcements subdirectory if it does not exist.
 * Overwrites any existing file with the same id.
 */
export async function writeAnnouncement(
	pcdPath: string,
	id: string,
	input: AnnouncementFileInput
): Promise<void> {
	const dir = `${pcdPath}/${ANNOUNCEMENTS_SUBDIR}`;
	await Deno.mkdir(dir, { recursive: true });

	const targetPath = `${dir}/${id}.md`;
	const content = formatFile(input);

	const tempPath = `${targetPath}.${crypto.randomUUID()}.tmp`;
	try {
		await Deno.writeTextFile(tempPath, content);
		await Deno.rename(tempPath, targetPath);
	} catch (error) {
		// Best-effort cleanup of the temp file. Swallow the cleanup error so
		// the original failure surfaces to the caller.
		try {
			await Deno.remove(tempPath);
		} catch {
			/* ignore */
		}
		throw error;
	}
}

/**
 * Remove `announcements/<id>.md`. Returns `true` when the file existed and
 * was removed, `false` when it did not exist. Any other error propagates.
 */
export async function deleteAnnouncement(pcdPath: string, id: string): Promise<boolean> {
	const path = `${pcdPath}/${ANNOUNCEMENTS_SUBDIR}/${id}.md`;
	try {
		await Deno.remove(path);
		return true;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) return false;
		throw error;
	}
}

function formatFile(input: AnnouncementFileInput): string {
	const frontmatter: Record<string, unknown> = {
		title: input.title,
		severity: input.severity,
		published_at: input.publishedAt
	};
	if (input.expiresAt !== null) frontmatter.expires_at = input.expiresAt;
	if (input.link !== null) frontmatter.link = input.link;

	// `stringifyYaml` produces a trailing newline on the last key, so the
	// closing `---` always sits on a fresh line.
	const yaml = stringifyYaml(frontmatter);

	if (input.body === '') {
		return `---\n${yaml}---\n`;
	}
	// One blank line between frontmatter and body matches the convention the
	// parser consumes (`---\n\n` ➜ skip one blank, then body).
	return `---\n${yaml}---\n\n${input.body}`;
}
