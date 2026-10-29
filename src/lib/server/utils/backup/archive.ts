/**
 * Archive content validation for zip slip protection.
 *
 * Validates tar.gz archives to ensure no entry would extract outside
 * the intended directory.
 */

import { runCommand } from '#utils/command.ts';

/**
 * Validate that a tar.gz archive contains no dangerous paths.
 *
 * Checks each entry for:
 * - Path traversal (`..` segments)
 * - Absolute paths (starting with `/`)
 *
 * Does NOT extract the archive — only lists and inspects entry names.
 */
export async function validateArchiveEntries(
	filePath: string
): Promise<{ valid: boolean; error?: string }> {
	const result = await runCommand('tar', ['-tzf', filePath]);

	if (result.code !== 0) {
		const stderr = new TextDecoder().decode(result.stderr);
		return { valid: false, error: `Failed to read archive: ${stderr.trim()}` };
	}

	const output = new TextDecoder().decode(result.stdout);
	const entries = output.split('\n').filter((line) => line.trim());

	for (const entry of entries) {
		// Check for path traversal
		const segments = entry.split('/');
		if (segments.some((s) => s === '..')) {
			return { valid: false, error: `Archive contains path traversal entry: ${entry}` };
		}

		// Check for absolute paths
		if (entry.startsWith('/')) {
			return { valid: false, error: `Archive contains absolute path entry: ${entry}` };
		}
	}

	return { valid: true };
}
