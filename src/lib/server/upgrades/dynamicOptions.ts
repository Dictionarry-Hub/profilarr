import type { ArrInstance } from '$lib/server/db/queries/arrInstances.ts';
import { RadarrClient } from '$lib/server/utils/arr/clients/radarr.ts';
import { SonarrClient } from '$lib/server/utils/arr/clients/sonarr.ts';
import type {
	ArrQualityProfile,
	ArrTag,
	RadarrMovie,
	RadarrMovieFile,
	SonarrSeries
} from '$lib/server/utils/arr/types.ts';
import {
	createEmptyDynamicFilterOptions,
	type DynamicFilterOptions
} from '$shared/upgrades/filters.ts';

function toOptions(values: Iterable<string | null | undefined>) {
	const unique = [...new Set([...values].map((v) => v?.trim()).filter(Boolean) as string[])];
	unique.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
	return unique.map((value) => ({ value, label: value }));
}

async function loadOptional<T>(load: () => Promise<T>): Promise<T | null> {
	try {
		return await load();
	} catch {
		return null;
	}
}

function setOptions(
	options: DynamicFilterOptions,
	field: string,
	values: Iterable<string | null | undefined>
) {
	options[field] = toOptions(values);
}

export async function loadDynamicFilterOptions(
	instance: ArrInstance
): Promise<DynamicFilterOptions> {
	const options = createEmptyDynamicFilterOptions(instance.type);
	const isRadarr = instance.type === 'radarr';
	const client = isRadarr
		? new RadarrClient(instance.url, instance.api_key)
		: new SonarrClient(instance.url, instance.api_key);

	const [profiles, tags, libraryItems] = await Promise.all([
		loadOptional<ArrQualityProfile[]>(() => client.getQualityProfiles()),
		loadOptional<ArrTag[]>(() => client.getTags()),
		isRadarr
			? loadOptional<RadarrMovie[]>(() => (client as RadarrClient).getMovies())
			: loadOptional<SonarrSeries[]>(() => (client as SonarrClient).getAllSeries())
	]);

	setOptions(options, 'quality_profile', profiles?.map((profile) => profile.name) ?? []);
	setOptions(options, 'tags', tags?.map((tag) => tag.label) ?? []);

	if (isRadarr) {
		const movies = (libraryItems ?? []) as RadarrMovie[];
		const movieIdsWithFiles = movies.filter((movie) => movie.hasFile).map((movie) => movie.id);
		const movieFiles = await loadOptional<RadarrMovieFile[]>(() =>
			(client as RadarrClient).getMovieFiles(movieIdsWithFiles)
		);

		setOptions(
			options,
			'original_language',
			movies.map((movie) => movie.originalLanguage?.name)
		);
		setOptions(
			options,
			'genres',
			movies.flatMap((movie) => movie.genres ?? [])
		);
		setOptions(options, 'release_group', movieFiles?.map((file) => file.releaseGroup) ?? []);

		return options;
	}

	const seriesList = (libraryItems ?? []) as SonarrSeries[];
	setOptions(
		options,
		'original_language',
		seriesList.map((series) => series.originalLanguage?.name)
	);
	setOptions(
		options,
		'genres',
		seriesList.flatMap((series) => series.genres ?? [])
	);
	setOptions(
		options,
		'network',
		seriesList.map((series) => series.network)
	);
	setOptions(
		options,
		'certification',
		seriesList.map((series) => series.certification)
	);

	return options;
}
