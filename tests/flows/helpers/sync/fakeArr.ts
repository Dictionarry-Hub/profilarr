/**
 * A fake app for flow tests, serving any target in the registry (targets.ts),
 * such as Radarr 6 or Sonarr 5.
 *
 * It starts from a fresh install's state, recorded from the real app by
 * `deno task fixtures:arr` (tests/flows/data/arr/<target id>), keeps changes
 * in memory like the real app, and records every request so a test can check
 * what Profilarr sent. Each path behaves as its target's resources describe.
 * Anything else answers 404 and is listed in `unhandled`, so a test can catch
 * Profilarr calling something new.
 *
 * A test can also:
 * - put the fake behind Basic Auth, like a reverse proxy (`basicAuth`)
 * - change, remove or add items the way a user would in the Arr itself
 *   (`edit`, `remove`, `seed`), including the movie and series library
 * - set a fixed answer for one path, e.g. health messages (`answer`)
 * - make a path fail or reject one item (`fail`, `reject`)
 */

import {
	createServer,
	type IncomingHttpHeaders,
	type IncomingMessage,
	type ServerResponse
} from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARR_DATA_DIR } from '$flows/harness/paths.ts';
import { freePort } from '$flows/harness/ports.ts';
import { recordingName, target as findTarget, type Target } from '$flows/helpers/sync/targets.ts';

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
	/** Answer every request to this method and path, or paths matching a pattern, with `status` */
	fail(method: string, path: PathMatch, status: number): void;
	/**
	 * Answer every request to this method and path with `value` and 200, e.g.
	 * `answer('GET', 'health', items)`. A path without a leading slash is
	 * relative to the API base.
	 */
	answer(method: string, path: PathMatch, value: unknown): void;
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
	const failures: { method: string; path: PathMatch; status: number }[] = [];
	const answers: { method: string; path: PathMatch; value: unknown }[] = [];

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

	/** Route a request; null means no route */
	function route(method: string, path: string, body: unknown): [number, unknown] | null {
		if (method === 'GET' && fixed.has(path)) return [200, fixed.get(path)];

		for (const resource of target.resources) {
			const base = apiPath(resource.path);
			const withId = path.match(new RegExp(`^${escape(base)}/(\\d+)$`));

			if (resource.kind === 'collection') {
				const store = lists.get(resource.path) ?? [];
				if (path === base) {
					if (method === 'GET') return [200, store];
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

			if (resource.kind === 'command' && method === 'POST' && path === base) {
				return [201, { id: 1, name: (body as Resource | null)?.name, status: 'completed' }];
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
		const failure = failures.find((f) => matches(entry, f.method, f.path));
		// The newest answer wins, so a test can replace one
		const answered = [...answers].reverse().find((a) => matches(entry, a.method, a.path));
		const allowed =
			key === apiKey && (!authorization || req.headers.authorization === authorization);
		const routed = allowed && !failure && !answered ? route(method, url.pathname, body) : null;

		if (!allowed) [status, payload] = [401, { error: 'Unauthorized' }];
		else if (failure) [status, payload] = [failure.status, { message: 'Failed by test' }];
		else if (answered) [status, payload] = [200, answered.value];
		else if (routed) [status, payload] = routed;
		else {
			[status, payload] = [404, { message: 'NotFound' }];
			unhandled.push(entry);
		}

		entry.status = status;
		res.writeHead(status, { 'Content-Type': 'application/json' });
		res.end(JSON.stringify(payload));
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
		fail: (method, path, status) => void failures.push({ method, path, status }),
		answer: (method, path, value) => void answers.push({ method, path: resolvePath(path), value }),
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
