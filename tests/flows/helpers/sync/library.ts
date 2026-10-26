/**
 * Builders for a realistic Arr library in the fake: movies and series with
 * the fields Profilarr reads, the files behind them, the releases an
 * interactive search finds and the queue records a search leaves.
 *
 * Builders take tag and custom format names, the way a user sees them.
 * `seedLibrary` writes the items and files into the fake, creating each tag
 * and custom format the fake doesn't have yet, so its ids line up.
 *
 * For renames, an item can carry `folderTo` and a file `renameTo`: the
 * folder and file names the Arr's naming config would give them. The fake
 * keeps them to itself and builds previews, renames and folder moves from
 * them.
 */

import { test } from '@playwright/test';
import type { FakeArr, Resource } from '$flows/helpers/sync/fakeArr.ts';

const GB = 1024 ** 3;

/** The library dates default to, an ISO timestamp */
const DEFAULT_ADDED = '2024-01-01T00:00:00Z';

/** A library item before seeding: tags are names, not ids yet */
export interface LibraryEntry {
	id: number;
	title: string;
	tags: string[];
	[field: string]: unknown;
}

/** A file before seeding: custom formats are names, not ids yet */
export interface FileEntry {
	/** The collection it goes into, moviefile or episodefile */
	collection: 'moviefile' | 'episodefile';
	formats: string[];
	[field: string]: unknown;
}

export interface MovieOptions {
	id: number;
	title: string;
	monitored?: boolean;
	/** The release state, e.g. "released" or "announced" */
	status?: string;
	/** When it was added, an ISO timestamp */
	added?: string;
	/** Set by `seedLibrary` for a movie with a file, so it can stay unset */
	hasFile?: boolean;
	/** Tag names */
	tags?: string[];
	/** An Arr quality profile id; default 1, the fresh install's "Any" */
	qualityProfileId?: number;
	genres?: string[];
	year?: number;
	/** The TMDb rating */
	rating?: number;
	/** Size on disk in GB */
	sizeGb?: number;
	popularity?: number;
	studio?: string;
	/** Where it lives; default `{rootFolderPath}/{title}` */
	path?: string;
	/** Its root folder; default /movies */
	rootFolderPath?: string;
	/** The folder name a move would give it, fake-only */
	folderTo?: string;
}

/** A Radarr movie with the fields upgrade filters and renames read */
export function radarrMovie(options: MovieOptions): LibraryEntry {
	const { id, title } = options;
	return {
		id,
		title,
		year: options.year ?? 2020,
		tmdbId: 10_000 + id,
		qualityProfileId: options.qualityProfileId ?? 1,
		monitored: options.monitored ?? true,
		status: options.status ?? 'released',
		minimumAvailability: 'released',
		added: options.added ?? DEFAULT_ADDED,
		hasFile: options.hasFile ?? false,
		tags: options.tags ?? [],
		genres: options.genres ?? [],
		ratings: { tmdb: { votes: 100, value: options.rating ?? 0 } },
		sizeOnDisk: (options.sizeGb ?? 0) * GB,
		popularity: options.popularity ?? 0,
		studio: options.studio ?? '',
		originalLanguage: { id: 1, name: 'English' },
		...placement(options, '/movies'),
		images: []
	};
}

/** An item's folder and root folder, plus the folder a move would give it */
function placement(
	options: { title: string; path?: string; rootFolderPath?: string; folderTo?: string },
	defaultRoot: string
) {
	const rootFolderPath = options.rootFolderPath ?? defaultRoot;
	return {
		path: options.path ?? `${rootFolderPath}/${options.title}`,
		rootFolderPath,
		...(options.folderTo !== undefined ? { folderTo: options.folderTo } : {})
	};
}

/** One season of a series, with how many of its episodes have files */
export interface SeasonOptions {
	seasonNumber: number;
	monitored?: boolean;
	episodeFileCount?: number;
}

export interface SeriesOptions {
	id: number;
	title: string;
	/** Every series has seasons; normalizing a series without them fails */
	seasons: SeasonOptions[];
	monitored?: boolean;
	/** e.g. "continuing" or "ended" */
	status?: string;
	added?: string;
	tags?: string[];
	qualityProfileId?: number;
	genres?: string[];
	year?: number;
	network?: string;
	/** standard, daily or anime */
	seriesType?: string;
	/** When the first episode aired, an ISO timestamp */
	firstAired?: string;
	sizeGb?: number;
	/** Where it lives; default `{rootFolderPath}/{title}` */
	path?: string;
	/** Its root folder; default /tv */
	rootFolderPath?: string;
	/** The folder name a move would give it, fake-only */
	folderTo?: string;
}

/** A Sonarr series with per-season monitoring and statistics */
export function sonarrSeries(options: SeriesOptions): LibraryEntry {
	const { id, title } = options;
	const seasons = options.seasons.map((season) => {
		const files = season.episodeFileCount ?? 0;
		return {
			seasonNumber: season.seasonNumber,
			monitored: season.monitored ?? true,
			statistics: {
				episodeFileCount: files,
				episodeCount: files,
				totalEpisodeCount: files,
				sizeOnDisk: 0,
				releaseGroups: [],
				percentOfEpisodes: files > 0 ? 100 : 0
			}
		};
	});
	const episodeFileCount = seasons.reduce((sum, s) => sum + s.statistics.episodeFileCount, 0);
	return {
		id,
		title,
		year: options.year ?? 2020,
		tvdbId: 20_000 + id,
		qualityProfileId: options.qualityProfileId ?? 1,
		monitored: options.monitored ?? true,
		status: options.status ?? 'continuing',
		added: options.added ?? DEFAULT_ADDED,
		tags: options.tags ?? [],
		genres: options.genres ?? [],
		network: options.network ?? '',
		seriesType: options.seriesType ?? 'standard',
		firstAired: options.firstAired ?? '2020-01-01T00:00:00Z',
		originalLanguage: { id: 1, name: 'English' },
		ratings: { value: 0, votes: 0 },
		...placement(options, '/tv'),
		images: [],
		seasons,
		statistics: {
			seasonCount: seasons.length,
			episodeCount: episodeFileCount,
			episodeFileCount,
			totalEpisodeCount: episodeFileCount,
			sizeOnDisk: (options.sizeGb ?? 0) * GB,
			percentOfEpisodes: 100
		}
	};
}

/** A file's name in its item's folder, and the name a rename would give it */
export interface FileNames {
	/** Relative to the item's folder, e.g. "alpha.mkv" or "Season 01/Show - S01E01.mkv" */
	relativePath?: string;
	/** The name the Arr's naming config would give it, fake-only */
	renameTo?: string;
}

/** A file's names, leaving `renameTo` out when it has none */
function names(file: FileNames, relativePath: string) {
	return {
		relativePath: file.relativePath ?? relativePath,
		...(file.renameTo !== undefined ? { renameTo: file.renameTo } : {})
	};
}

/** A movie's file, with its custom format score and the formats it matched */
export function movieFile(
	movieId: number,
	score: number,
	formats: string[] = [],
	fileNames: FileNames = {}
): FileEntry {
	return {
		collection: 'moviefile',
		movieId,
		...names(fileNames, `Movie ${movieId}.mkv`),
		size: GB,
		quality: { quality: { id: 7, name: 'Bluray-1080p' } },
		releaseGroup: 'FLOW',
		customFormatScore: score,
		formats
	};
}

/** An episode file of a series' season, with its custom format score */
export function episodeFile(
	seriesId: number,
	seasonNumber: number,
	score: number,
	fileNames: FileNames = {}
): FileEntry {
	return {
		collection: 'episodefile',
		seriesId,
		seasonNumber,
		...names(fileNames, `Season ${seasonNumber}/Series ${seriesId} S${seasonNumber}.mkv`),
		size: GB,
		quality: { quality: { id: 7, name: 'Bluray-1080p' } },
		customFormatScore: score,
		formats: []
	};
}

export interface ReleaseOptions {
	/** Whether the Arr would grab it; default true */
	approved?: boolean;
	rejected?: boolean;
	formats?: string[];
}

/** A release an interactive search (GET release) finds */
export function release(title: string, score: number, options: ReleaseOptions = {}) {
	const approved = options.approved ?? !options.rejected;
	return {
		guid: `flow-${title}`,
		title,
		size: GB,
		indexer: 'Flow Indexer',
		approved,
		rejected: options.rejected ?? !approved,
		customFormatScore: score,
		customFormats: (options.formats ?? []).map((name, index) => ({ id: index + 1, name })),
		quality: { quality: { id: 7, name: 'Bluray-1080p', source: 'bluray', resolution: 1080 } }
	};
}

export interface QueueRecordOptions {
	/** Radarr: the movie it was grabbed for */
	movieId?: number;
	/** Sonarr: the series and season it was grabbed for */
	seriesId?: number;
	seasonNumber?: number;
	formats?: string[];
	/** Records of one download, such as each episode of a season pack, share it */
	downloadId?: string;
}

/** A record GET queue lists after a search grabbed a release */
export function queueRecord(title: string, score: number, options: QueueRecordOptions = {}) {
	return {
		title,
		status: 'downloading',
		...(options.movieId !== undefined ? { movieId: options.movieId } : {}),
		...(options.seriesId !== undefined
			? { seriesId: options.seriesId, seasonNumber: options.seasonNumber ?? 1 }
			: {}),
		customFormatScore: score,
		customFormats: (options.formats ?? []).map((name, index) => ({ id: index + 1, name })),
		quality: { quality: { id: 7, name: 'Bluray-1080p' } },
		downloadId: options.downloadId ?? `flow-${title}`,
		protocol: 'torrent',
		indexer: 'Flow Indexer'
	};
}

/** The id of a named item in a fake collection, created when missing */
function idFor(fake: FakeArr, collection: 'tag' | 'customformat', name: string): number {
	const key = collection === 'tag' ? 'label' : 'name';
	const existing = fake.collection(collection).find((item) => item[key] === name);
	if (existing) return existing.id;
	fake.seed(collection, [collection === 'tag' ? { label: name } : { name, specifications: [] }]);
	const created = fake.collection(collection).find((item) => item[key] === name);
	if (!created) throw new Error(`The fake ${fake.target.id} didn't add ${collection} "${name}"`);
	return created.id;
}

/** The library a test starts with */
export interface Library {
	items: LibraryEntry[];
	files?: FileEntry[];
}

/**
 * Write the items and files into the fake's library, the way a user's Arr
 * holds them. Movies with a file get `hasFile` and `movieFileId`.
 */
export async function seedLibrary(fake: FakeArr, library: Library): Promise<void> {
	await test.step(
		`Seed ${library.items.length} item(s) into the fake ${fake.target.id}`,
		() => {
			const isRadarr = fake.type === 'radarr';
			const fileCollection = isRadarr ? 'moviefile' : 'episodefile';
			for (const { collection, formats, ...file } of library.files ?? []) {
				if (collection !== fileCollection) {
					throw new Error(`A ${fake.type} library takes ${fileCollection}, not ${collection}`);
				}
				const customFormats = formats.map((name) => ({
					id: idFor(fake, 'customformat', name),
					name
				}));
				fake.seed(collection, [{ ...file, customFormats }]);
			}

			const files = fake.collection(fileCollection);
			fake.seed(
				isRadarr ? 'movie' : 'series',
				library.items.map((item) => {
					const tags = item.tags.map((label) => idFor(fake, 'tag', label));
					const file = isRadarr ? files.find((f) => f.movieId === item.id) : undefined;
					return file ? { ...item, tags, hasFile: true, movieFileId: file.id } : { ...item, tags };
				})
			);
		},
		{ box: true }
	);
}

/** The tag names an item carries in the fake right now, sorted */
export function tagsOf(fake: FakeArr, item: Resource): string[] {
	const labels = new Map(fake.collection('tag').map((tag) => [tag.id, String(tag.label)]));
	return ((item.tags as number[] | undefined) ?? []).map((id) => labels.get(id) ?? `#${id}`).sort();
}

/** The ids of the fake's library items carrying a tag, sorted */
export function taggedIds(fake: FakeArr, label: string): number[] {
	return fake
		.collection(fake.type === 'radarr' ? 'movie' : 'series')
		.filter((item) => tagsOf(fake, item).includes(label))
		.map((item) => item.id)
		.sort((a, b) => a - b);
}
