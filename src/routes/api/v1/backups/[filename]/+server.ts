import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { config } from '$config';
import { logger } from '$logger/logger.ts';
import { isValidBackupFilename, resolveBackupPath } from '$utils/backup/validation.ts';
import { buildSanitizedArchive } from '$utils/backup/sanitize.ts';

type ErrorResponse = components['schemas']['ErrorResponse'];

/**
 * GET /api/v1/backups/{filename}
 *
 * Download a backup. The local archive on disk is full-fidelity, but the
 * downloaded copy is sanitized on the fly before being streamed back: arr
 * instances and notification services are deleted (cascading through their
 * sync/history tables), users/sessions are wiped, and other secret-bearing
 * fields are nulled. See `$utils/backup/sanitize.ts` for the exact policy.
 */
export const GET: RequestHandler = async ({ params }) => {
	const { filename } = params;

	if (!filename || !isValidBackupFilename(filename)) {
		const error: ErrorResponse = { error: 'Invalid filename' };
		return json(error, { status: 400 });
	}

	const backupPath = resolveBackupPath(filename, config.paths.backups);
	if (!backupPath) {
		const error: ErrorResponse = { error: 'Invalid filename' };
		return json(error, { status: 400 });
	}

	try {
		await Deno.stat(backupPath);
	} catch {
		const error: ErrorResponse = { error: 'Backup file not found' };
		return json(error, { status: 404 });
	}

	let bytes: Uint8Array;
	try {
		bytes = await buildSanitizedArchive(backupPath);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await logger.error('Failed to sanitize backup for download', {
			source: 'api/v1/backups/download',
			meta: { filename, error: message }
		});
		const error: ErrorResponse = { error: 'Failed to prepare backup for download' };
		return json(error, { status: 500 });
	}

	return new Response(bytes, {
		headers: {
			'Content-Type': 'application/gzip',
			'Content-Disposition': `attachment; filename="${filename}"`
		}
	});
};

/**
 * DELETE /api/v1/backups/{filename}
 *
 * Delete a backup file.
 */
export const DELETE: RequestHandler = async ({ params }) => {
	const { filename } = params;

	if (!filename || !isValidBackupFilename(filename)) {
		const error: ErrorResponse = { error: 'Invalid filename' };
		return json(error, { status: 400 });
	}

	const backupPath = resolveBackupPath(filename, config.paths.backups);
	if (!backupPath) {
		const error: ErrorResponse = { error: 'Invalid filename' };
		return json(error, { status: 400 });
	}

	try {
		await Deno.stat(backupPath);
	} catch {
		const error: ErrorResponse = { error: 'Backup file not found' };
		return json(error, { status: 404 });
	}

	await Deno.remove(backupPath);
	return json({ success: true });
};
