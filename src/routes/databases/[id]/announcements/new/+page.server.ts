import { error, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import {
	generateAnnouncementId,
	reconcileFromWorkingCopy,
	writeAnnouncement,
	type AnnouncementFileInput
} from '$announcements/database/index.ts';
import { getPCDPath } from '$pcd/utils/operations.ts';
import { logger } from '$logger/logger.ts';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id || '', 10);
	if (Number.isNaN(id)) error(400, 'Invalid database ID');
	if (!databaseInstancesQueries.getById(id)) error(404, 'Database not found');
	return {};
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

		const input = parseInput(await request.formData());
		if ('error' in input) return { success: false, error: input.error };

		const announcementId = generateAnnouncementId();
		try {
			await writeAnnouncement(getPCDPath(database.uuid), announcementId, input);
		} catch (err) {
			await logger.error('Failed to write announcement file', {
				source: 'announcements.authoring',
				meta: { databaseId: id, announcementId, error: String(err) }
			});
			return {
				success: false,
				error: err instanceof Error ? err.message : 'Failed to write file'
			};
		}

		// Sync the new file into the DB so the maintainer sees it on
		// /announcements immediately. No notification fire (we use the
		// non-notify variant): the maintainer just authored this.
		// `isFirstSync: false` keeps inserts unread so the maintainer can
		// see their item in the inbox like any other entry; the silent
		// path is reserved for users newly linking a database with a
		// backlog of historical announcements.
		await reconcileFromWorkingCopy(id, { isFirstSync: false });

		throw redirect(303, `/databases/${id}/announcements`);
	}
};
