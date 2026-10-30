/**
 * A fake app for flow tests, serving any target in the registry (targets.ts),
 * such as Radarr 6 or Sonarr 5.
 *
 * It starts from a fresh install's state, recorded from the real app by
 * `pnpm fixtures:arr` (tests/flows/data/arr/<target id>), keeps changes
 * in memory like the real app, and records every request so a test can check
 * what Profilarr sent. Each path behaves as its target's resources describe.
 * Anything else answers 404 and is listed in `unhandled`, so a test can catch
 * Profilarr calling something new.
 *
 * A test can also:
 * - put the fake behind Basic Auth, like a reverse proxy (`basicAuth`)
 * - change, remove or add items the way a user would in the Arr itself
 *   (`edit`, `remove`, `seed`), including the movie and series library
 * - set a fixed answer for one path, e.g. health messages, or an answer per
 *   request, e.g. releases per movie (`answer`)
 * - make a path fail, for every request or one query such as one item's
 *   id, or reject one item (`fail`, `reject`)
 * - run commands: each is queued, then completes on its first status check,
 *   or ends as the test set with `commandOutcome`, adding queue records the
 *   way a search that grabbed releases does
 * - rename files and move folders from seeded state: a file's fake-only
 *   `renameTo` and an item's `folderTo` are the names the Arr's naming
 *   config would give them. Previews list the difference, rename commands
 *   and folder moves apply it. Neither field appears in an answer.
 */

import {
	createServer,
	type IncomingHttpHeaders,
	type IncomingMessage,
	type ServerResponse
} from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARR_DATA_DIR } from '#flows/harness/paths.ts';
import { freePort } from '#flows/harness/ports.ts';
import { recordingName, target as findTarget, type FolderMove, type Target } from './targets.ts';

export type ArrType = Target['app'];

export interface RecordedRequest {
	method: string;
	/** Path without the query string, e.g. /api/v3/customformat */
	path: string;
	query: URLSearchParams;
	/** Request headers, with lowercase names, e.g. `authorization` */
	headers: IncomingHttpHeaders;
	body: unknown;
	status: number;
}

export interface Resource {
	id: number;
	name?: string;
	[key: string]: unknown;
}

/** An exact path, or a pattern for paths with ids, e.g. /^\/api\/v3\/qualityprofile\/\d+$/ */
export type PathMatch = string | RegExp;

function matches(request: { method: string; path: string }, method: string, path: PathMatch) {
	if (request.method !== method) return false;
	return typeof path === 'string' ? request.path === path : path.test(request.path);
}

/** Whether a request carries every one of these query parameters, e.g. `{ movieId: '3' }` */
function hasQuery(request: { query: URLSearchParams }, query: Record<string, string> = {}) {
	return Object.entries(query).every(([name, value]) => request.query.get(name) === value);
}

/** Fields only the fake knows: the names the Arr's naming config would give */
const FAKE_ONLY = new Set(['renameTo', 'folderTo']);

/** The episode numbers in a file name, e.g. [1, 2] for "Show - S01E01E02.mkv" */
const episodeNumbers = (name: string) =>
	[...name.matchAll(/E(\d+)/gi)].map((match) => Number(match[1]));

/** Credentials a reverse proxy in front of the Arr would ask for */
export interface BasicAuth {
	username: string;
	password: string;
}

/** The Authorization header a client sends for these credentials */
export function basicAuthHeader({ username, password }: BasicAuth): string {
	return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`;
}

/** One item of GET /health */
export interface HealthItem {
	source: string;
	type: 'ok' | 'notice' | 'warning' | 'error';
	message: string;
	wikiUrl: string;
}

/** How a command ends, and the queue records it leaves, e.g. the releases a search grabbed */
export interface CommandOutcome {
	status: 'completed' | 'failed';
	/** The command's message, e.g. "1 reports downloaded" or "Indexer unavailable" */
	message?: string;
	/** Records GET queue lists once the command has ended */
	queue?: Record<string, unknown>[];
	/** Complete without doing the work, e.g. a rename command that renames no file */
	noEffect?: boolean;
}

/** One outcome for every command of a name, or one per command, e.g. by the ids it lists */
export type CommandOutcomes = CommandOutcome | ((command: Resource) => CommandOutcome);

/** A fixed answer, or one worked out from each request, e.g. releases per movie */
export type Answer = unknown | ((request: RecordedRequest) => unknown);

/** A library item to seed, e.g. { id: 1, title: 'A', tmdbId: 11 } */
export interface LibraryItem {
	id: number;
	title: string;
	tmdbId?: number;
	tvdbId?: number;
}

/**
 * The health message the app raises for media its metadata source removed,
 * worded like the real check: Radarr's RemovedMovieCheck names the TMDb id,
 * Sonarr's RemovedSeriesCheck the TVDB id.
 */
export function removedMediaHealth(type: ArrType, item: LibraryItem): HealthItem {
	return type === 'radarr'
		? {
				source: 'RemovedMovieCheck',
				type: 'error',
				message: `Movie ${item.title} (tmdbid ${item.tmdbId}) was removed from TMDb`,
				wikiUrl: 'https://wiki.servarr.com/radarr/system#movie-was-removed-from-tmdb'
			}
		: {
				source: 'RemovedSeriesCheck',
				type: 'error',
				message: `Series ${item.title} (tvdbid ${item.tvdbId}) was removed from TheTVDB`,
				wikiUrl: 'https://wiki.servarr.com/sonarr/system#series-removed-from-thetvdb'
			};
}

export interface FakeArr {
	/** The registry entry this fake serves */
	target: Target;
	/** The app, e.g. "sonarr" */
	type: ArrType;
	url: string;
	apiKey: string;
	/** Every request, oldest first */
	requests: RecordedRequest[];
	/** Requests the fake had no route for */
	unhandled: RecordedRequest[];
	/** A collection or bulk resource's current items, by its path, e.g. "customformat" */
	collection(path: string): Resource[];
	/** A singleton resource's current value, by its path, e.g. "config/naming" */
	singleton(path: string): Resource;
	/** Bodies of requests with this method and path, or a path matching a pattern */
	sent(method: string, path: PathMatch): unknown[];
	/**
	 * The first answered request with this method and path, waiting for it if
	 * it hasn't arrived yet. Fails after `timeoutMs`, listing what did arrive.
	 */
	waitFor(method: string, path: PathMatch, timeoutMs?: number): Promise<RecordedRequest>;
	/** Answer creating or updating `name` in a collection with a validation error */
	reject(collection: string, name: string, status?: number): void;
	/**
	 * Answer every request to this method and path, or paths matching a
	 * pattern, with `status`. With `query`, only requests carrying those
	 * parameters fail, e.g. `{ movieId: '3' }` for one movie's previews.
	 */
	fail(method: string, path: PathMatch, status: number, query?: Record<string, string>): void;
	/**
	 * Answer every request to this method and path with `value` and 200, e.g.
	 * `answer('GET', 'health', items)`. `value` can be a function of the
	 * request, to answer each item on its own, e.g. releases by `movieId`. A
	 * path without a leading slash is relative to the API base.
	 */
	answer(method: string, path: PathMatch, value: Answer): void;
	/**
	 * End every later command named `name` this way, e.g. `MoviesSearch`
	 * failing, or pick an outcome per command, e.g. failing the batch that
	 * lists series 11
	 */
	commandOutcome(name: string, outcome: CommandOutcomes): void;
	/** The bodies of every command posted, oldest first */
	commands(): Record<string, unknown>[];
	/**
	 * Every command GET command lists, oldest first, with its id and status:
	 * the posted ones and those the Arr started itself, such as a folder move
	 */
	listedCommands(): Resource[];
	/**
	 * With each later folder move, also start a RefreshMonitoredDownloads in
	 * the same moment, as the Arr's minute refresh can. It completes on its
	 * first status check.
	 */
	strayCommandWithMove(): void;
	/**
	 * Change items the way a user editing in the Arr would, without recording a
	 * request. `select` picks items of a collection or bulk resource, or must
	 * match a singleton. `patch` merges into each item, or changes it in place.
	 */
	edit(
		path: string,
		select: (item: Resource) => boolean,
		patch: Record<string, unknown> | ((item: Resource) => void)
	): void;
	/** Delete the items `select` picks from a collection, like a user would in the Arr */
	remove(path: string, select: (item: Resource) => boolean): void;
	/** Add items to a collection, like a user would in the Arr; an item without an id gets the next one */
	seed(path: string, items: Record<string, unknown>[]): void;
	stop(): Promise<void>;
}

/** The value an answer gives this request */
function answerFor(answer: Answer, request: RecordedRequest): unknown {
	return typeof answer === 'function'
		? (answer as (request: RecordedRequest) => unknown)(request)
		: answer;
}

function readBody(req: IncomingMessage): Promise<unknown> {
	return new Promise((resolveBody) => {
		const chunks: Buffer[] = [];
		req.on('data', (chunk: Buffer) => chunks.push(chunk));
		req.on('end', () => {
			const text = Buffer.concat(chunks).toString('utf8');
			if (!text) return resolveBody(null);
			try {
				resolveBody(JSON.parse(text));
			} catch {
				resolveBody(text);
			}
		});
	});
}

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export interface FakeArrOptions {
	apiKey?: string;
	/** Answer 401 to every request without these Basic Auth credentials, like a reverse proxy */
	basicAuth?: BasicAuth;
}

export async function startFakeArr(
	targetId: string,
	options: FakeArrOptions = {}
): Promise<FakeArr> {
	const target = findTarget(targetId);
	const apiKey = options.apiKey ?? `fake-${target.id}-key`;
	const authorization = options.basicAuth ? basicAuthHeader(options.basicAuth) : undefined;
	const requests: RecordedRequest[] = [];
	// Callers of waitFor, checked each time a request has been answered
	const waiters: (() => void)[] = [];
	const unhandled: RecordedRequest[] = [];
	const rejections: { collection: string; name: string; status: number }[] = [];
	const failures: {
		method: string;
		path: PathMatch;
		status: number;
		query?: Record<string, string>;
	}[] = [];
	const answers: { method: string; path: PathMatch; value: Answer }[] = [];
	const outcomes = new Map<string, CommandOutcomes>();
	let strayWithMove = false;
	// Commands as posted, and as GET command lists them
	const posted: Record<string, unknown>[] = [];
	const commandList: Resource[] = [];
	const queue: Record<string, unknown>[] = [];

	const apiPath = (path: string) => (path.startsWith('/') ? path : `${target.apiBase}/${path}`);
	const recordingFile = (path: string) => join(ARR_DATA_DIR, target.id, recordingName(path));
	const recorded = <T>(path: string, fallback: T): T => {
		const file = recordingFile(path);
		return existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as T) : fallback;
	};

	// Recorded paths that no resource claims, and the stubs, answer GET as recorded
	const claimed = new Set(target.resources.map((resource) => resource.path));
	const fixed = new Map<string, unknown>();
	for (const path of target.record) {
		if (!claimed.has(path) && existsSync(recordingFile(path))) {
			fixed.set(apiPath(path), recorded(path, null));
		}
	}
	for (const [path, value] of Object.entries(target.stubs)) fixed.set(apiPath(path), value);

	// Current state of every stateful resource, starting from its recording
	const lists = new Map<string, Resource[]>();
	const objects = new Map<string, Resource>();
	for (const resource of target.resources) {
		if (resource.kind === 'collection' || resource.kind === 'bulk') {
			lists.set(resource.path, recorded<Resource[]>(resource.path, []));
		} else if (resource.kind === 'singleton') {
			objects.set(resource.path, recorded<Resource>(resource.path, { id: 1 }));
		}
	}

	const nextId = (store: Resource[]) => store.reduce((max, item) => Math.max(max, item.id), 0) + 1;

	function rejection(collection: string, body: unknown) {
		const name = (body as Resource | null)?.name;
		return rejections.find((r) => r.collection === collection && r.name === name);
	}

	const rejected = (collection: string, body: unknown): [number, unknown] | null => {
		const found = rejection(collection, body);
		return found
			? [found.status, [{ propertyName: 'Name', errorMessage: 'Rejected by test' }]]
			: null;
	};

	const renameCommands = target.resources.flatMap((resource) =>
		resource.kind === 'command' ? (resource.renames ?? []) : []
	);

	/** Rename the files a completed rename command lists to their `renameTo` */
	function applyRenames(command: Resource): void {
		for (const rename of renameCommands.filter((r) => r.command === command.name)) {
			const ids = (command[rename.ids] as number[] | undefined) ?? [];
			for (const file of lists.get(rename.files) ?? []) {
				if (!ids.includes(Number(file[rename.by]))) continue;
				if (typeof file.renameTo === 'string') file.relativePath = file.renameTo;
			}
		}
	}

	/** End a queued or started command with its outcome, adding the outcome's queue records */
	function finish(command: Resource): void {
		if (command.status !== 'queued' && command.status !== 'started') return;
		const set = outcomes.get(String(command.name));
		const outcome = (typeof set === 'function' ? set(command) : set) ?? { status: 'completed' };
		command.status = outcome.status;
		if (outcome.message !== undefined) command.message = outcome.message;
		queue.push(...(outcome.queue ?? []));
		if (outcome.status === 'completed' && !outcome.noEffect) applyRenames(command);
	}

	/** Move the folders an editor lists and add the move command the Arr starts */
	function moveFolders(move: FolderMove, items: Resource[], rootFolderPath: string): void {
		const moved = items.map((item) => {
			const sourcePath = item.path;
			if (typeof item.folderTo === 'string') item.path = `${rootFolderPath}/${item.folderTo}`;
			return { [move.itemId]: item.id, sourcePath };
		});
		commandList.push({
			id: commandList.length + 1,
			name: move.command,
			commandName: move.label,
			status: 'completed',
			body: { [move.list]: moved, destinationRootFolder: rootFolderPath }
		});
		if (strayWithMove) {
			commandList.push({
				id: commandList.length + 1,
				name: 'RefreshMonitoredDownloads',
				commandName: 'Refresh Monitored Downloads',
				status: 'started'
			});
		}
	}

	/** Route a request; null means no route */
	function route(
		method: string,
		path: string,
		query: URLSearchParams,
		body: unknown
	): [number, unknown] | null {
		if (method === 'GET' && fixed.has(path)) return [200, fixed.get(path)];

		for (const resource of target.resources) {
			const base = apiPath(resource.path);
			const withId = path.match(new RegExp(`^${escape(base)}/(\\d+)$`));

			if (resource.kind === 'collection') {
				const store = lists.get(resource.path) ?? [];
				if (path === base) {
					if (method === 'GET') {
						const wanted = resource.filterBy ? query.getAll(resource.filterBy) : [];
						if (wanted.length === 0) return [200, store];
						const field = resource.filterBy ?? '';
						return [200, store.filter((item) => wanted.includes(String(item[field])))];
					}
					if (method === 'POST') {
						const refused = rejected(resource.path, body);
						if (refused) return refused;
						const created = { ...(body as Resource), id: nextId(store) };
						store.push(created);
						return [201, created];
					}
					return null;
				}
				if (!withId) continue;
				const id = Number(withId[1]);
				const index = store.findIndex((item) => item.id === id);
				if (index === -1) return [404, { message: 'NotFound' }];
				if (method === 'GET') return [200, store[index]];
				if (method === 'PUT') {
					const refused = rejected(resource.path, body);
					if (refused) return refused;
					store[index] = { ...(body as Resource), id };
					return [202, store[index]];
				}
				if (method === 'DELETE') {
					store.splice(index, 1);
					return [200, {}];
				}
				return null;
			}

			if (resource.kind === 'singleton') {
				if (method === 'GET' && path === base) return [200, objects.get(resource.path)];
				if (method === 'PUT' && withId) {
					const value = { ...(body as Resource), id: Number(withId[1]) };
					objects.set(resource.path, value);
					return [202, value];
				}
				if (path === base || withId) return null;
				continue;
			}

			if (resource.kind === 'bulk') {
				const store = lists.get(resource.path) ?? [];
				if (path === base) return method === 'GET' ? [200, store] : null;
				if (method === 'PUT' && path === apiPath(resource.update)) {
					for (const update of (body as Resource[]) ?? []) {
						const index = store.findIndex((item) => item.id === update.id);
						if (index !== -1) store[index] = { ...store[index], ...update };
					}
					return [202, store];
				}
				continue;
			}

			if (resource.kind === 'command') {
				if (method === 'GET' && path === apiPath(resource.queue)) {
					return [200, { page: 1, pageSize: 200, totalRecords: queue.length, records: queue }];
				}
				if (path === base) {
					if (method === 'GET') return [200, commandList];
					if (method !== 'POST') return null;
					const request = (body as Record<string, unknown> | null) ?? {};
					posted.push(request);
					const command: Resource = {
						...request,
						id: commandList.length + 1,
						name: String(request.name ?? ''),
						status: 'queued'
					};
					commandList.push(command);
					return [201, { ...command }];
				}
				if (!withId) continue;
				const command = commandList.find((item) => item.id === Number(withId[1]));
				if (!command) return [404, { message: 'NotFound' }];
				if (method !== 'GET') return null;
				finish(command);
				return [200, command];
			}

			if (resource.kind === 'preview' && path === base) {
				if (method !== 'GET') return null;
				const source = resource.sources.find((s) => query.has(s.query));
				if (!source) return [200, []];
				const id = Number(query.get(source.query));
				const previews = (lists.get(source.files) ?? [])
					.filter((file) => file[source.query] === id)
					.filter((file) => typeof file.renameTo === 'string')
					.filter((file) => file.renameTo !== file.relativePath)
					.map((file) => ({
						[source.query]: id,
						...(file.seasonNumber === undefined
							? {}
							: {
									seasonNumber: file.seasonNumber,
									episodeNumbers: episodeNumbers(String(file.relativePath))
								}),
						[source.fileId]: file.id,
						existingPath: file.relativePath,
						newPath: file.renameTo
					}));
				return [200, previews];
			}

			if (resource.kind === 'editor' && path === base) {
				if (method !== 'PUT') return null;
				const edit = (body as Record<string, unknown> | null) ?? {};
				const ids = new Set((edit[resource.ids] as number[] | undefined) ?? []);
				const tags = (edit.tags as number[] | undefined) ?? [];
				const store = lists.get(resource.collection) ?? [];
				if (resource.move && edit.moveFiles === true && typeof edit.rootFolderPath === 'string') {
					const items = store.filter((item) => ids.has(item.id));
					moveFolders(resource.move, items, edit.rootFolderPath);
					return [resource.move.status, items];
				}
				for (const item of store) {
					if (!ids.has(item.id) || edit.tags === undefined) continue;
					const current = (item.tags as number[] | undefined) ?? [];
					item.tags =
						edit.applyTags === 'remove'
							? current.filter((tag) => !tags.includes(tag))
							: edit.applyTags === 'replace'
								? [...tags]
								: [...current, ...tags.filter((tag) => !current.includes(tag))];
				}
				return [202, store.filter((item) => ids.has(item.id))];
			}
		}

		return null;
	}

	async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
		const url = new URL(req.url ?? '/', 'http://fake');
		const method = req.method ?? 'GET';
		const body = await readBody(req);
		const entry: RecordedRequest = {
			method,
			path: url.pathname,
			query: url.searchParams,
			headers: req.headers,
			body,
			status: 0
		};
		requests.push(entry);

		let status: number;
		let payload: unknown;
		const key =
			req.headers[target.auth.header.toLowerCase()] ?? url.searchParams.get(target.auth.query);
		const failure = failures.find(
			(f) => matches(entry, f.method, f.path) && hasQuery(entry, f.query)
		);
		// The newest answer wins, so a test can replace one
		const answered = [...answers].reverse().find((a) => matches(entry, a.method, a.path));
		const allowed =
			key === apiKey && (!authorization || req.headers.authorization === authorization);
		const routed =
			allowed && !failure && !answered ? route(method, url.pathname, url.searchParams, body) : null;

		if (!allowed) [status, payload] = [401, { error: 'Unauthorized' }];
		else if (failure) [status, payload] = [failure.status, { message: 'Failed by test' }];
		else if (answered) [status, payload] = [200, answerFor(answered.value, entry)];
		else if (routed) [status, payload] = routed;
		else {
			[status, payload] = [404, { message: 'NotFound' }];
			unhandled.push(entry);
		}

		entry.status = status;
		res.writeHead(status, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(payload, (field, value) => (FAKE_ONLY.has(field) ? undefined : value)));
		for (const wake of [...waiters]) wake();
	}

	/** A collection or bulk resource's items, failing with the target id when there is none */
	function listOf(path: string): Resource[] {
		const store = lists.get(path);
		if (!store) throw new Error(`${target.id} has no collection "${path}"`);
		return store;
	}

	const resolvePath = (path: PathMatch): PathMatch =>
		typeof path === 'string' ? apiPath(path) : path;

	const port = await freePort();
	const server = createServer((req, res) => void handle(req, res));
	await new Promise<void>((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

	return {
		target,
		type: target.app,
		url: `http://127.0.0.1:${port}`,
		apiKey,
		requests,
		unhandled,
		collection: listOf,
		singleton: (path) => {
			const value = objects.get(path);
			if (!value) throw new Error(`${target.id} has no singleton "${path}"`);
			return value;
		},
		sent: (method, path) => requests.filter((r) => matches(r, method, path)).map((r) => r.body),
		waitFor: (method, path, timeoutMs = 10_000) =>
			new Promise<RecordedRequest>((resolveWait, rejectWait) => {
				const answered = () => requests.find((r) => r.status !== 0 && matches(r, method, path));
				const found = answered();
				if (found) return resolveWait(found);

				const wake = () => {
					const request = answered();
					if (!request) return;
					clearTimeout(timer);
					waiters.splice(waiters.indexOf(wake), 1);
					resolveWait(request);
				};
				const timer = setTimeout(() => {
					waiters.splice(waiters.indexOf(wake), 1);
					const seen = requests.map((r) => `${r.method} ${r.path}`).join(', ') || 'none';
					rejectWait(
						new Error(
							`The fake ${target.id} got no ${method} ${path} within ${timeoutMs}ms. Got: ${seen}`
						)
					);
				}, timeoutMs);
				waiters.push(wake);
			}),
		reject: (collection, name, status = 400) => void rejections.push({ collection, name, status }),
		fail: (method, path, status, query) => void failures.push({ method, path, status, query }),
		answer: (method, path, value) => void answers.push({ method, path: resolvePath(path), value }),
		commandOutcome: (name, outcome) => void outcomes.set(name, outcome),
		commands: () => [...posted],
		listedCommands: () => commandList.map((command) => ({ ...command })),
		strayCommandWithMove: () => {
			strayWithMove = true;
		},
		edit: (path, select, patch) => {
			const change = (item: Resource): Resource => {
				if (typeof patch === 'function') {
					patch(item);
					return item;
				}
				return { ...item, ...patch };
			};
			const single = objects.get(path);
			if (single) {
				if (!select(single)) throw new Error(`${target.id} "${path}" doesn't match the selection`);
				objects.set(path, change(single));
				return;
			}
			const store = listOf(path);
			const picked = store.filter(select);
			if (picked.length === 0) throw new Error(`${target.id} "${path}" has no matching item`);
			for (const item of picked) store[store.indexOf(item)] = change(item);
		},
		remove: (path, select) => {
			const store = listOf(path);
			const kept = store.filter((item) => !select(item));
			if (kept.length === store.length) {
				throw new Error(`${target.id} "${path}" has no matching item`);
			}
			store.splice(0, store.length, ...kept);
		},
		seed: (path, items) => {
			const store = listOf(path);
			for (const item of items) {
				store.push({ ...item, id: typeof item.id === 'number' ? item.id : nextId(store) });
			}
		},
		stop: () =>
			new Promise<void>((resolveStop) => {
				server.close(() => resolveStop());
				// The app keeps its connection open for reuse; without this, close()
				// waits for it until the app goes away
				server.closeAllConnections();
			})
	};
}
