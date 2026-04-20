/**
 * GET /api/v1/announcements
 *
 * Returns the list of visible announcements (withdrawn, expired, and
 * version-incompatible entries filtered server-side). Bodies are omitted;
 * use GET /api/v1/announcements/{id} for the full payload.
 */

import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import type { components } from '$api/v1';
import { listVisible } from '$lib/server/announcements/index.ts';
import type { AnnouncementRecord } from '$lib/server/announcements/types.ts';

type AnnouncementSummary = components['schemas']['AnnouncementSummary'];

function toSummary(a: AnnouncementRecord): AnnouncementSummary {
	return {
		id: a.id,
		title: a.title,
		severity: a.severity,
		publishedAt: a.publishedAt,
		expiresAt: a.expiresAt,
		minVersion: a.minVersion,
		maxVersion: a.maxVersion,
		link: a.link,
		readAt: a.readAt
	};
}

export const GET: RequestHandler = () => {
	return json(listVisible().map(toSummary));
};
