import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { parseAnnouncementsDir } from '$announcements/database/index.ts';
import { getPCDPath } from '$pcd/utils/operations.ts';

export const load: PageServerLoad = async ({ params }) => {
	const id = parseInt(params.id || '', 10);
	if (Number.isNaN(id)) error(400, 'Invalid database ID');

	const database = databaseInstancesQueries.getById(id);
	if (!database) error(404, 'Database not found');

	const result = await parseAnnouncementsDir(getPCDPath(database.uuid));

	const rows = result.parsed
		.map((p) => ({
			id: p.id,
			title: p.title,
			severity: p.severity,
			publishedAt: p.published_at,
			expiresAt: p.expires_at,
			link: p.link,
			body: p.body
		}))
		.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));

	return {
		announcements: rows,
		parseErrors: result.errors
	};
};
