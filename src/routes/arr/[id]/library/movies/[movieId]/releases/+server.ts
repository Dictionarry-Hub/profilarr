import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '#db/queries/arrInstances.ts';
import { RadarrClient } from '#arr/clients/radarr.ts';
import { arrClientOptionsFromInstance } from '#arr/factory.ts';
import { groupRadarrReleases } from '#arr/releaseImport.ts';
import { logger } from '#logger/logger.ts';

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	const movieId = parseInt(params.movieId ?? '', 10);
	if (!Number.isFinite(instanceId) || !Number.isFinite(movieId)) {
		return Response.json({ error: 'Invalid instance or movie ID' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return Response.json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'radarr') {
		return Response.json(
			{ error: 'Movie releases are only available for Radarr instances' },
			{
				status: 400
			}
		);
	}

	const client = new RadarrClient(
		instance.url,
		instance.api_key,
		arrClientOptionsFromInstance(instance)
	);
	try {
		const releases = await client.getReleases(movieId);
		const grouped = groupRadarrReleases(releases);
		return Response.json({ rawCount: releases.length, releases: grouped });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch releases';
		await logger.error(`Failed to fetch releases for movie ${movieId}`, {
			source: 'arr/library/movies/releases',
			meta: { instanceId, movieId, error: message }
		});
		return Response.json({ error: message }, { status: 500 });
	}
};
