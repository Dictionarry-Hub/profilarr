import { error } from '@sveltejs/kit';
import { redirect } from '$utils/redirect/redirect.ts';
import type { Actions, PageServerLoad } from './$types';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import {
	deleteAnnouncement,
	parseAnnouncementFile,
	reconcileFromWorkingCopy,
	writeAnnouncement,
	type AnnouncementFileInput
} from '$announcements/database/index.ts';
import { getPCDPath } from '$pcd/utils/operations.ts';
import { logger } from '$logger/logger.ts';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id || '', 10);
	if (Number.isNaN(id)) error(400, 'Invalid database ID');

	const database = databaseInstancesQueries.getById(id);
	if (!database) error(404, 'Database not found');

	const ulid = params.ulid;
	if (!ulid) error(400, 'Missing announcement id');

	const result = await parseAnnouncementFile(getPCDPath(database.uuid), ulid);
	if (result === null) error(404, 'Announcement not found');

	if ('reason' in result) {
		// Malformed file: return what we know so the maintainer can edit and fix.
		return {
			parseError: result.reason,
			announcement: {
				id: ulid,
				title: '',
				severity: 'info' as const,
				publishedAt: new Date().toISOString(),
				expiresAt: null,
				link: '',
				body: ''
			}
		};
	}

	return {
		parseError: null,
		announcement: {
			id: result.id,
			title: result.title,
			severity: result.severity,
			publishedAt: result.published_at,
			expiresAt: result.expires_at,
			link: result.link ?? '',
			body: result.body
		}
	};
};

function parseInput(form: FormData): AnnouncementFileInput | { error: string } {
	const title = form.get('title');
	const severity = form.get('severity');
	const publishedAt = form.get('publishedAt');
	const expiresAtRaw = form.get('expiresAt');
	const linkRaw = form.get('link');
	const body = form.get('body');

	if (typeof title !== 'string' || title.trim() === '') return { error: 'Title is required' };
	if (severity !== 'info' && severity !== 'warning' && severity !== 'critical') {
		return { error: 'Severity must be info, warning, or critical' };
	}
	if (typeof publishedAt !== 'string' || publishedAt === '') {
		return { error: 'Published timestamp is required' };
	}
	if (Number.isNaN(Date.parse(publishedAt))) {
		return { error: 'Published timestamp is not a valid date' };
	}

	let expiresAt: string | null = null;
	if (typeof expiresAtRaw === 'string' && expiresAtRaw !== '') {
		if (Number.isNaN(Date.parse(expiresAtRaw))) {
			return { error: 'Expires timestamp is not a valid date' };
		}
		expiresAt = expiresAtRaw;
	}

	const link = typeof linkRaw === 'string' && linkRaw.trim() !== '' ? linkRaw.trim() : null;
	const bodyText = typeof body === 'string' ? body : '';

	return {
		title: title.trim(),
		severity,
		publishedAt,
		expiresAt,
		link,
		body: bodyText
	};
}

export const actions: Actions = {
	save: async ({ request, params }) => {
		const id = parseInt(params.id || '', 10);
		if (Number.isNaN(id)) return { success: false, error: 'Invalid database id' };

		const database = databaseInstancesQueries.getById(id);
		if (!database) return { success: false, error: 'Database not found' };

		const ulid = params.ulid;
		if (!ulid) return { success: false, error: 'Missing announcement id' };

		const input = parseInput(await request.formData());
		if ('error' in input) return { success: false, error: input.error };

		try {
			await writeAnnouncement(getPCDPath(database.uuid), ulid, input);
		} catch (err) {
			await logger.error('Failed to write announcement file', {
				source: 'announcements.authoring',
				meta: { databaseId: id, announcementId: ulid, error: String(err) }
			});
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Failed to write file'
			};
		}

		// Reconcile the change into the DB so the inbox reflects it. No
		// notification fire: the maintainer just edited this themselves.
		await reconcileFromWorkingCopy(id, { isFirstSync: false });

		throw redirect(303, `/databases/${id}/announcements`);
	},
	delete: async ({ params }) => {
		const id = parseInt(params.id || '', 10);
		if (Number.isNaN(id)) return { success: false, error: 'Invalid database id' };

		const database = databaseInstancesQueries.getById(id);
		if (!database) return { success: false, error: 'Database not found' };

		const ulid = params.ulid;
		if (!ulid) return { success: false, error: 'Missing announcement id' };

		try {
			const removed = await deleteAnnouncement(getPCDPath(database.uuid), ulid);
			if (!removed) return { success: false, error: 'Announcement file no longer exists' };
		} catch (err) {
			await logger.error('Failed to delete announcement file', {
				source: 'announcements.authoring',
				meta: { databaseId: id, announcementId: ulid, error: String(err) }
			});
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Failed to delete file'
			};
		}

		// Reconcile the deletion: the row gets marked withdrawn for any
		// linked instances. No notification fire on the maintainer side.
		await reconcileFromWorkingCopy(id, { isFirstSync: false });

		throw redirect(303, `/databases/${id}/announcements`);
	}
};
