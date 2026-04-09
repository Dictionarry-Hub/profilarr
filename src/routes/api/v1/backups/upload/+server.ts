import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { config } from '$config';
import { formatFileSize } from '$utils/backup/validation.ts';
import { validateArchiveEntries } from '$utils/backup/archive.ts';

type BackupUploadResponse = components['schemas']['BackupUploadResponse'];
type ErrorResponse = components['schemas']['ErrorResponse'];

const MAX_SIZE = 1024 * 1024 * 1024; // 1GB

/**
 * POST /api/v1/backups/upload
 *
 * Upload a backup archive. Validates extension, size, and archive contents
 * (zip slip protection). Stores in the backups directory.
 */
export const POST: RequestHandler = async ({ request }) => {
	const formData = await request.formData();
	const file = formData.get('file') as File | null;

	if (!file) {
		const error: ErrorResponse = { error: 'No file provided' };
		return json(error, { status: 400 });
	}

	if (!file.name.endsWith('.tar.gz')) {
		const error: ErrorResponse = { error: 'Invalid file type. Only .tar.gz files are allowed.' };
		return json(error, { status: 400 });
	}

	if (file.size > MAX_SIZE) {
		const error: ErrorResponse = { error: 'File too large. Maximum size is 1GB.' };
		return json(error, { status: 400 });
	}

	const backupsDir = config.paths.backups;
	const filename = file.name.startsWith('backup-')
		? file.name
		: `backup-uploaded-${Date.now()}.tar.gz`;
	const backupPath = `${backupsDir}/${filename}`;

	// Check for duplicate
	try {
		await Deno.stat(backupPath);
		const error: ErrorResponse = { error: 'A backup with this name already exists' };
		return json(error, { status: 400 });
	} catch {
		// File doesn't exist — good
	}

	// Write to temp location for validation
	const tmpPath = `${backupsDir}/.upload-${Date.now()}.tmp.tar.gz`;
	const arrayBuffer = await file.arrayBuffer();
	const uint8Array = new Uint8Array(arrayBuffer);

	try {
		await Deno.writeFile(tmpPath, uint8Array);

		// Validate archive contents (zip slip protection)
		const validation = await validateArchiveEntries(tmpPath);
		if (!validation.valid) {
			await Deno.remove(tmpPath);
			const error: ErrorResponse = {
				error: 'Archive contains path traversal entries and was rejected'
			};
			return json(error, { status: 400 });
		}

		// Move to final location
		await Deno.rename(tmpPath, backupPath);

		const stat = await Deno.stat(backupPath);
		const response: BackupUploadResponse = {
			filename,
			size: stat.size,
			sizeFormatted: formatFileSize(stat.size)
		};
		return json(response, { status: 201 });
	} catch (err) {
		// Clean up temp file if it still exists
		try {
			await Deno.remove(tmpPath);
		} catch {
			// Already cleaned up or never written
		}

		const message = err instanceof Error ? err.message : 'Upload failed';
		const error: ErrorResponse = { error: message };
		return json(error, { status: 500 });
	}
};
