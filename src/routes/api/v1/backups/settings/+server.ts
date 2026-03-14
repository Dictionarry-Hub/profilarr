import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1.d.ts';
import { backupSettingsQueries } from '$db/queries/backupSettings.ts';
import { scheduleBackupJobs } from '$lib/server/jobs/schedule.ts';

type BackupSettings = components['schemas']['BackupSettings'];
type ErrorResponse = components['schemas']['ErrorResponse'];

const VALID_SCHEDULES = new Set(['hourly', 'daily', 'weekly', 'monthly']);

/**
 * GET /api/v1/backups/settings
 *
 * Returns the current backup configuration.
 */
export const GET: RequestHandler = async () => {
	const settings = backupSettingsQueries.get();
	if (!settings) {
		const error: ErrorResponse = { error: 'Backup settings not found' };
		return json(error, { status: 500 });
	}

	const response: BackupSettings = {
		schedule: settings.schedule as BackupSettings['schedule'],
		retentionDays: settings.retention_days,
		enabled: settings.enabled === 1,
		includeDatabase: settings.include_database === 1,
		compressionEnabled: settings.compression_enabled === 1
	};

	return json(response);
};

/**
 * PATCH /api/v1/backups/settings
 *
 * Updates backup configuration. Only provided fields are changed.
 * Reschedules backup jobs after update.
 */
export const PATCH: RequestHandler = async ({ request }) => {
	const body = await request.json();
	const { schedule, retentionDays, enabled } = body;

	// Must have at least one field
	if (schedule === undefined && retentionDays === undefined && enabled === undefined) {
		const error: ErrorResponse = { error: 'No fields to update' };
		return json(error, { status: 400 });
	}

	// Validate schedule
	if (schedule !== undefined && !VALID_SCHEDULES.has(schedule)) {
		const error: ErrorResponse = {
			error: `Invalid schedule. Must be one of: ${[...VALID_SCHEDULES].join(', ')}`
		};
		return json(error, { status: 400 });
	}

	// Validate retentionDays
	if (retentionDays !== undefined) {
		if (typeof retentionDays !== 'number' || retentionDays < 1 || retentionDays > 365) {
			const error: ErrorResponse = { error: 'retentionDays must be between 1 and 365' };
			return json(error, { status: 400 });
		}
	}

	// Validate enabled
	if (enabled !== undefined && typeof enabled !== 'boolean') {
		const error: ErrorResponse = { error: 'enabled must be a boolean' };
		return json(error, { status: 400 });
	}

	// Build update input
	const updateInput: {
		schedule?: string;
		retentionDays?: number;
		enabled?: boolean;
	} = {};

	if (schedule !== undefined) updateInput.schedule = schedule;
	if (retentionDays !== undefined) updateInput.retentionDays = retentionDays;
	if (enabled !== undefined) updateInput.enabled = enabled;

	backupSettingsQueries.update(updateInput);
	await scheduleBackupJobs();

	// Return updated settings
	const updated = backupSettingsQueries.get()!;
	const response: BackupSettings = {
		schedule: updated.schedule as BackupSettings['schedule'],
		retentionDays: updated.retention_days,
		enabled: updated.enabled === 1,
		includeDatabase: updated.include_database === 1,
		compressionEnabled: updated.compression_enabled === 1
	};

	return json(response);
};
