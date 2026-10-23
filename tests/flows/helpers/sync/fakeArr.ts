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
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
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

export async function startFakeArr(
	targetId: string,
	options: { apiKey?: string } = {}
): Promise<FakeArr> {
	const target = findTarget(targetId);
	const apiKey = options.apiKey ?? `fake-${target.id}-key`;
	const requests: RecordedRequest[] = [];
	// Callers of waitFor, checked each time a request has been answered
	const waiters: (() => void)[] = [];
	const unhandled: RecordedRequest[] = [];
	const rejections: { collection: string; name: string; status: number }[] = [];
	const failures: { method: string; path: PathMatch; status: number }[] = [];

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
			body,
			status: 0
		};
		requests.push(entry);

		let status: number;
		let payload: unknown;
		const key =
			req.headers[target.auth.header.toLowerCase()] ?? url.searchParams.get(target.auth.query);
		const failure = failures.find((f) => matches(entry, f.method, f.path));
		const routed = key === apiKey && !failure ? route(method, url.pathname, body) : null;

		if (key !== apiKey) [status, payload] = [401, { error: 'Unauthorized' }];
		else if (failure) [status, payload] = [failure.status, { message: 'Failed by test' }];
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
		collection: (path) => {
			const store = lists.get(path);
			if (!store) throw new Error(`${target.id} has no collection "${path}"`);
			return store;
		},
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
		stop: () =>
			new Promise<void>((resolveStop) => {
				server.close(() => resolveStop());
				// The app keeps its connection open for reuse; without this, close()
				// waits for it until the app goes away
				server.closeAllConnections();
			})
	};
}
