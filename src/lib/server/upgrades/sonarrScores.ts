import type { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import type { SonarrEpisodeFile, SonarrSeries } from '$utils/arr/types.ts';
import { filterGroupUsesField, type FilterConfig } from '$shared/upgrades/filters.ts';

const EPISODE_FILE_FETCH_CONCURRENCY = 10;

export type SonarrEpisodeFileMap = Map<number, SonarrEpisodeFile[]>;

export function averageEpisodeFileScore(
	files: SonarrEpisodeFile[],
	seasonNumber?: number
): number {
	const matchingFiles =
		seasonNumber === undefined
			? files
			: files.filter((file) => file.seasonNumber === seasonNumber);

	if (matchingFiles.length === 0) return 0;

	return (
		matchingFiles.reduce((total, file) => total + (file.customFormatScore ?? 0), 0) /
		matchingFiles.length
	);
}

export function filterNeedsSonarrScores(filter: FilterConfig): boolean {
	return filter.selector === 'lowest_score' || filterGroupUsesField(filter.group, 'cutoff_met');
}

function getEpisodeFileCount(series: SonarrSeries): number | undefined {
	if (series.statistics) return series.statistics.episodeFileCount;
	if (series.seasons.every((season) => season.statistics)) {
		return series.seasons.reduce(
			(total, season) => total + (season.statistics?.episodeFileCount ?? 0),
			0
		);
	}
	return undefined;
}

export async function loadSonarrEpisodeFiles(
	client: SonarrClient,
	seriesList: SonarrSeries[],
	existing: SonarrEpisodeFileMap = new Map()
): Promise<SonarrEpisodeFileMap> {
	const result = new Map(existing);
	const missing = seriesList.filter((series) => !result.has(series.id));

	for (let index = 0; index < missing.length; index += EPISODE_FILE_FETCH_CONCURRENCY) {
		const batch = missing.slice(index, index + EPISODE_FILE_FETCH_CONCURRENCY);
		const loaded = await Promise.all(
			batch.map(async (series) => {
				if (getEpisodeFileCount(series) === 0) {
					return [series.id, [] as SonarrEpisodeFile[]] as const;
				}

				try {
					return [series.id, await client.getEpisodeFiles(series.id)] as const;
				} catch (error) {
					const message = error instanceof Error ? error.message : String(error);
					throw new Error(`Failed to fetch episode files for "${series.title}": ${message}`);
				}
			})
		);

		for (const [seriesId, files] of loaded) {
			result.set(seriesId, files);
		}
	}

	return result;
}
