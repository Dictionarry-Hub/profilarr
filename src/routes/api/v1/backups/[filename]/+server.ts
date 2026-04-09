import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { config } from '$config';
import { isValidBackupFilename, resolveBackupPath } from '$utils/backup/validation.ts';

type ErrorResponse = components['schemas']['ErrorResponse'];

/**
 * GET /api/v1/backups/{filename}
 *
 * Download a backup file.
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

	const file = await Deno.readFile(backupPath);
	return new Response(file, {
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
