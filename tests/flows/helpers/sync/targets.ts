/**
 * Every API the flow suite can fake, described as data. A target is one app
 * at one API version: what to record from a real container, how each path
 * behaves in the fake, and what the app can do. Adding a version or a new app
 * means adding a target here and recording it with `pnpm fixtures:arr
 * <id>`; the fake (fakeArr.ts) and the recording script read this registry.
 *
 * Helpers branch on capabilities, never on versions, so a new target with a
 * known capability works without helper changes. Kept free of Playwright
 * imports so scripts can use it.
 */

/** What Profilarr can sync to a target. Mirrors the app's own capability rules. */
export type Capability =
	| 'qualityProfiles'
	| 'delayProfiles'
	| 'naming'
	| 'mediaSettings'
	/** Global quality definitions, set in Media Management */
	| 'qualityDefinitions'
	/** Sizes stored on each quality profile, set in Quality Profiles (Sonarr v5) */
	| 'profileSizes';

/** How a path behaves in the fake. Paths are relative to the target's apiBase. */
export type Resource =
	/**
	 * A list with get, create, update and delete by id: `path`, `path/{id}`.
	 * With `filterBy`, GET `path?{filterBy}=1&{filterBy}=2` lists only the
	 * items whose `filterBy` field is one of the values.
	 */
	| { kind: 'collection'; path: string; filterBy?: string }
	/** One settings object: GET `path`, PUT `path/{id}` */
	| { kind: 'singleton'; path: string }
	/** A list read whole and updated in bulk: GET `path`, PUT `update` merges by id */
	| { kind: 'bulk'; path: string; update: string }
	/**
	 * POST `path` stores a command with the next id and answers it as queued.
	 * The first GET `path/{id}` answers it with its outcome, completed unless a
	 * test set another, and adds the outcome's queue records to GET `queue`.
	 * GET `path` lists every stored command. A completed command named in
	 * `renames` does its work: see `RenameCommand`.
	 */
	| { kind: 'command'; path: string; queue: string; renames?: RenameCommand[] }
	/**
	 * A bulk editor: PUT `path` applies `applyTags` (add, remove or replace)
	 * with `tags` to every item of `collection` whose id is in the body's `ids`.
	 * With `move`, a body with `rootFolderPath` and `moveFiles: true` moves
	 * the items' folders instead: see `FolderMove`.
	 */
	| { kind: 'editor'; path: string; collection: string; ids: string; move?: FolderMove }
	/**
	 * Rename previews: GET `path?{query}={id}` lists the item's files whose
	 * fake-only `renameTo` differs from their `relativePath`, one source per
	 * app. A file with a `seasonNumber` (Sonarr) also gets its episode numbers,
	 * read from the `E01` parts of its name.
	 */
	| { kind: 'preview'; path: string; sources: PreviewSource[] };

/**
 * A rename command, e.g. `RenameMovie { movieIds }`: once completed, each file
 * of `files` whose `by` field is one of the command's `ids` takes its
 * fake-only `renameTo` as its `relativePath`. File ids stay the same.
 */
export interface RenameCommand {
	command: string;
	ids: string;
	files: string;
	by: string;
}

/**
 * A folder move through an editor: each listed item's `path` becomes
 * `rootFolderPath/{folderTo}`, an item without the fake-only `folderTo` keeps
 * its path, and the Arr adds a completed `command` (shown as `label`) whose
 * body lists `{ [itemId], sourcePath }` under `list`. The editor answers
 * `status`.
 */
export interface FolderMove {
	command: string;
	label: string;
	list: string;
	itemId: string;
	status: number;
}

/** Where rename previews for one app come from, e.g. `movieId` over `moviefile` */
export interface PreviewSource {
	/** The query parameter, also the file field naming the item, e.g. "movieId" */
	query: string;
	/** The file collection, e.g. "moviefile" */
	files: string;
	/** The preview field holding the file id, e.g. "movieFileId" */
	fileId: string;
}

export interface Target {
	/** App and API version, e.g. "sonarr-5"; also its folder under data/arr/ */
	id: string;
	/** The app, also the key for its fixtures (naming, quality definitions, ...) */
	app: 'radarr' | 'sonarr';
	/** The app's name as Profilarr's Type dropdown shows it */
	label: string;
	/** The app's major version. Recording checks the container reports it. */
	major: number;
	/** The image the recording comes from */
	image: string;
	/** The port the app listens on inside its container */
	port: number;
	/** Where the API lives; paths below are relative to it unless they start with / */
	apiBase: string;
	/** How a request carries the API key */
	auth: { header: string; query: string };
	/** A path that answers once the app is ready */
	ready: string;
	/** Where a fresh container writes its API key */
	apiKeyFrom: { file: string; pattern: RegExp };
	/** GET paths to record; each becomes a fixed answer unless a resource claims it */
	record: string[];
	resources: Resource[];
	/** Fixed answers for paths that aren't recorded, such as an empty library */
	stubs: Record<string, unknown>;
	capabilities: Capability[];
}

const EMPTY_PAGE = { page: 1, pageSize: 200, totalRecords: 0, records: [] };

/** What Radarr and Sonarr share on API v3 */
const ARR_V3 = {
	apiBase: '/api/v3',
	auth: { header: 'x-api-key', query: 'apikey' },
	ready: 'system/status',
	apiKeyFrom: { file: '/config/config.xml', pattern: /<ApiKey>([^<]+)<\/ApiKey>/ },
	record: [
		'system/status',
		'qualityprofile',
		'qualityprofile/schema',
		'customformat',
		'delayprofile',
		'qualitydefinition',
		'config/naming',
		'config/mediamanagement',
		'tag',
		'health',
		'/api'
	],
	resources: [
		{ kind: 'collection', path: 'customformat' },
		{ kind: 'collection', path: 'qualityprofile' },
		{ kind: 'collection', path: 'delayprofile' },
		{ kind: 'collection', path: 'tag' },
		// The library and its files, empty like a fresh install until a test seeds them
		{ kind: 'collection', path: 'movie' },
		{ kind: 'collection', path: 'series' },
		{ kind: 'collection', path: 'moviefile', filterBy: 'movieId' },
		{ kind: 'collection', path: 'episodefile', filterBy: 'seriesId' },
		// Folder moves as seen on Radarr 6 and Sonarr 5. Sonarr 4 is assumed to
		// answer the same, unchecked.
		{
			kind: 'editor',
			path: 'movie/editor',
			collection: 'movie',
			ids: 'movieIds',
			move: {
				command: 'BulkMoveMovie',
				label: 'Bulk Move Movie',
				list: 'movies',
				itemId: 'movieId',
				status: 202
			}
		},
		{
			kind: 'editor',
			path: 'series/editor',
			collection: 'series',
			ids: 'seriesIds',
			move: {
				command: 'BulkMoveSeries',
				label: 'Bulk Move Series',
				list: 'series',
				itemId: 'seriesId',
				status: 200
			}
		},
		{
			kind: 'preview',
			path: 'rename',
			sources: [
				{ query: 'movieId', files: 'moviefile', fileId: 'movieFileId' },
				{ query: 'seriesId', files: 'episodefile', fileId: 'episodeFileId' }
			]
		},
		{ kind: 'singleton', path: 'config/naming' },
		{ kind: 'singleton', path: 'config/mediamanagement' },
		{ kind: 'bulk', path: 'qualitydefinition', update: 'qualitydefinition/update' },
		{
			kind: 'command',
			path: 'command',
			queue: 'queue',
			renames: [
				{ command: 'RenameMovie', ids: 'movieIds', files: 'moviefile', by: 'movieId' },
				{ command: 'RenameSeries', ids: 'seriesIds', files: 'episodefile', by: 'seriesId' }
			]
		}
	],
	// Empty answers for the rest of the library, so background jobs get valid answers
	stubs: {
		episode: [],
		release: [],
		'log/file': [],
		log: EMPTY_PAGE
	}
} satisfies Partial<Target>;

const ARR_V3_CAPABILITIES: Capability[] = [
	'qualityProfiles',
	'delayProfiles',
	'naming',
	'mediaSettings',
	'qualityDefinitions'
];

export const TARGETS: Target[] = [
	{
		...ARR_V3,
		id: 'radarr-6',
		app: 'radarr',
		label: 'Radarr',
		major: 6,
		image: 'lscr.io/linuxserver/radarr:latest',
		port: 7878,
		capabilities: ARR_V3_CAPABILITIES
	},
	{
		...ARR_V3,
		id: 'sonarr-4',
		app: 'sonarr',
		label: 'Sonarr',
		major: 4,
		image: 'lscr.io/linuxserver/sonarr:latest',
		port: 8989,
		capabilities: ARR_V3_CAPABILITIES
	},
	{
		...ARR_V3,
		id: 'sonarr-5',
		app: 'sonarr',
		label: 'Sonarr',
		major: 5,
		image: 'lscr.io/linuxserver/sonarr:develop-version-5.0.0.2569',
		port: 8989,
		capabilities: ['qualityProfiles', 'delayProfiles', 'naming', 'mediaSettings', 'profileSizes']
	}
];

/** The file a recorded path is saved as: qualityprofile/schema -> qualityprofile.schema.json, /api -> api.json */
export function recordingName(path: string): string {
	const trimmed = path.replace(/^\//, '');
	return `${trimmed.replaceAll('/', '.') || 'root'}.json`;
}

/** The target an app's plain fixture (`fakeRadarr`, `fakeSonarr`) uses */
const DEFAULTS: Record<Target['app'], string> = { radarr: 'radarr-6', sonarr: 'sonarr-4' };

/** A target by id; an unknown id fails with the ids that exist */
export function target(id: string): Target {
	const found = TARGETS.find((candidate) => candidate.id === id);
	if (!found) {
		throw new Error(`No fake target "${id}". Known: ${TARGETS.map((t) => t.id).join(', ')}`);
	}
	return found;
}

/** Every target with a capability, e.g. to run one spec against each */
export function targetsWith(capability: Capability): Target[] {
	return TARGETS.filter((candidate) => candidate.capabilities.includes(capability));
}

export function defaultTarget(app: Target['app']): Target {
	return target(DEFAULTS[app]);
}

export function hasCapability(of: Target, capability: Capability): boolean {
	return of.capabilities.includes(capability);
}
