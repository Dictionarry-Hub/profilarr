import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { RadarrClient } from '$utils/arr/clients/radarr.ts';
import { groupRadarrReleases } from '$utils/arr/releaseImport.ts';
import { logger } from '$logger/logger.ts';

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	const movieId = parseInt(params.movieId ?? '', 10);
	if (!Number.isFinite(instanceId) || !Number.isFinite(movieId)) {
		return json({ error: 'Invalid instance or movie ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'radarr') {
		return json(
			{ error: 'Movie releases are only available for Radarr instances' },
			{
				status: 400
			}
		);
	}

	const client = new RadarrClient(instance.url, instance.api_key);
	try {
		const releases = await client.getReleases(movieId);
		const grouped = groupRadarrReleases(releases);
		return json({ rawCount: releases.length, releases: grouped });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch releases';
		await logger.error(`Failed to fetch releases for movie ${movieId}`, {
			source: 'arr/library/movies/releases',
			meta: { instanceId, movieId, error: message }
		});
		return json({ error: message }, { status: 500 });
	} finally {
		client.close();
	}
};
