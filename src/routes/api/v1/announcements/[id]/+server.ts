/**
 * GET /api/v1/announcements/{id}
 *
 * Returns the full announcement including its markdown body. Body is
 * lazy-fetched from the bulletin on first call and cached locally.
 * Returns 404 if the id is unknown or has not yet been ingested.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { getDetail } from '$lib/server/announcements/index.ts';
import type { AnnouncementRecord } from '$lib/server/announcements/types.ts';

type AnnouncementDetail = components['schemas']['AnnouncementDetail'];

function toDetail(a: AnnouncementRecord): AnnouncementDetail {
	return {
		id: a.id,
		title: a.title,
		severity: a.severity,
		publishedAt: a.publishedAt,
		expiresAt: a.expiresAt,
		minVersion: a.minVersion,
		maxVersion: a.maxVersion,
		link: a.link,
		readAt: a.readAt,
		body: a.body
	};
}

export const GET: RequestHandler = async ({ params }) => {
	const id = params.id;
	if (!id) {
		return json({ error: 'id is required' }, { status: 400 });
	}

	const record = await getDetail(id, { loadBody: true });
	if (!record) {
		return json({ error: 'Announcement not found' }, { status: 404 });
	}

	return json(toDetail(record));
};
