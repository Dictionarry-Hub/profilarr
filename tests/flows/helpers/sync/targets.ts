/**
 * Every API the flow suite can fake, described as data. A target is one app
 * at one API version: what to record from a real container, how each path
 * behaves in the fake, and what the app can do. Adding a version or a new app
 * means adding a target here and recording it with `deno task fixtures:arr
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
	/** A list with get, create, update and delete by id: `path`, `path/{id}` */
	| { kind: 'collection'; path: string }
	/** One settings object: GET `path`, PUT `path/{id}` */
	| { kind: 'singleton'; path: string }
	/** A list read whole and updated in bulk: GET `path`, PUT `update` merges by id */
	| { kind: 'bulk'; path: string; update: string }
	/** POST starts a command, answered as completed */
	| { kind: 'command'; path: string };

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
		{ kind: 'singleton', path: 'config/naming' },
		{ kind: 'singleton', path: 'config/mediamanagement' },
		{ kind: 'bulk', path: 'qualitydefinition', update: 'qualitydefinition/update' },
		{ kind: 'command', path: 'command' }
	],
	// An empty library, so background jobs get valid answers
	stubs: {
		movie: [],
		series: [],
		episode: [],
		rename: [],
		release: [],
		command: [],
		'log/file': [],
		queue: EMPTY_PAGE,
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
