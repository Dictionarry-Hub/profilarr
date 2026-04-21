import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import { groupSonarrReleases } from '$utils/arr/releaseImport.ts';
import { logger } from '$logger/logger.ts';

export const GET: RequestHandler = async ({ params }) => {
	const instanceId = parseInt(params.id ?? '', 10);
	const seriesId = parseInt(params.seriesId ?? '', 10);
	const seasonNumber = parseInt(params.seasonNumber ?? '', 10);
	if (
		!Number.isFinite(instanceId) ||
		!Number.isFinite(seriesId) ||
		!Number.isFinite(seasonNumber)
	) {
		return json({ error: 'Invalid instance, series, or season number' }, { status: 400 });
	}

	const instance = arrInstancesQueries.getById(instanceId);
	if (!instance) {
		return json({ error: 'Instance not found' }, { status: 404 });
	}
	if (instance.type !== 'sonarr') {
		return json(
			{ error: 'Season releases are only available for Sonarr instances' },
			{ status: 400 }
		);
	}

	const client = new SonarrClient(instance.url, instance.api_key);
	try {
		const releases = await client.getSeasonPackReleases(seriesId, seasonNumber);
		const grouped = groupSonarrReleases(releases);
		return json({ rawCount: releases.length, releases: grouped });
	} catch (err) {
		const message = err instanceof Error ? err.message : 'Failed to fetch releases';
		await logger.error(`Failed to fetch releases for series ${seriesId} season ${seasonNumber}`, {
			source: 'arr/library/series/seasons/releases',
			meta: { instanceId, seriesId, seasonNumber, error: message }
		});
		return json({ error: message }, { status: 500 });
	} finally {
		client.close();
	}
};
