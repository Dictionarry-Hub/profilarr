/**
 * A fake Radarr or Sonarr for flow tests.
 *
 * It starts from a fresh install's state, recorded from the real apps by
 * `deno task fixtures:arr` (tests/flows/data/arr), keeps changes in memory
 * like a real Arr, and records every request so a test can check what
 * Profilarr sent. Anything it doesn't support answers 404 and is listed in
 * `unhandled`, so a test can catch Profilarr calling something new.
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ARR_DATA_DIR } from '$flows/helpers/paths.ts';
import { freePort } from '$flows/helpers/ports.ts';

export type ArrType = 'radarr' | 'sonarr';

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

/** Collections that support list, get, create, update and delete */
export type Collection = 'customformat' | 'qualityprofile' | 'delayprofile' | 'tag';

export interface FakeArr {
	type: ArrType;
	url: string;
	apiKey: string;
	/** Every request, oldest first */
	requests: RecordedRequest[];
	/** Requests the fake had no route for */
	unhandled: RecordedRequest[];
	/** Current state, changed by Profilarr's writes */
	collections: Record<Collection, Resource[]>;
	qualityDefinitions: Resource[];
	naming: Resource;
	mediaManagement: Resource;
	/** Bodies of requests with this method and path */
	sent(method: string, path: string): unknown[];
	/** Answer creating or updating `name` in `collection` with a validation error */
	reject(collection: Collection, name: string, status?: number): void;
	/** Answer every request to this method and path with `status` */
	fail(method: string, path: string, status: number): void;
	stop(): Promise<void>;
}

const API = '/api/v3';
const COLLECTIONS: Collection[] = ['customformat', 'qualityprofile', 'delayprofile', 'tag'];
const EMPTY_PAGE = { page: 1, pageSize: 200, totalRecords: 0, records: [] };

function load<T>(type: ArrType, file: string): T {
	return JSON.parse(readFileSync(join(ARR_DATA_DIR, type, file), 'utf8')) as T;
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

export async function startFakeArr(
	type: ArrType,
	options: { apiKey?: string } = {}
): Promise<FakeArr> {
	const apiKey = options.apiKey ?? `fake-${type}-key`;
	const requests: RecordedRequest[] = [];
	const unhandled: RecordedRequest[] = [];
	const rejections: { collection: Collection; name: string; status: number }[] = [];
	const failures: { method: string; path: string; status: number }[] = [];

	const collections = Object.fromEntries(
		COLLECTIONS.map((name) => [name, load<Resource[]>(type, `${name}.json`)])
	) as Record<Collection, Resource[]>;
	const qualityDefinitions = load<Resource[]>(type, 'qualitydefinition.json');
	const fake = {
		naming: load<Resource>(type, 'config.naming.json'),
		mediaManagement: load<Resource>(type, 'config.mediamanagement.json')
	};
	const staticResponses: Record<string, unknown> = {
		'/api': load(type, 'api.json'),
		[`${API}/system/status`]: load(type, 'system.status.json'),
		[`${API}/health`]: load(type, 'health.json'),
		[`${API}/qualityprofile/schema`]: load(type, 'qualityprofile.schema.json'),
		// An empty library, so background jobs get valid answers
		[`${API}/movie`]: [],
		[`${API}/series`]: [],
		[`${API}/episode`]: [],
		[`${API}/rename`]: [],
		[`${API}/release`]: [],
		[`${API}/command`]: [],
		[`${API}/log/file`]: [],
		[`${API}/queue`]: EMPTY_PAGE,
		[`${API}/log`]: EMPTY_PAGE
	};

	function nextId(store: Resource[]): number {
		return store.reduce((max, item) => Math.max(max, item.id), 0) + 1;
	}

	function rejection(collection: Collection, body: unknown) {
		const name = (body as Resource | null)?.name;
		return rejections.find((r) => r.collection === collection && r.name === name);
	}

	/** Route a request; null means no route */
	function route(method: string, path: string, body: unknown): [number, unknown] | null {
		if (method === 'GET' && path in staticResponses) return [200, staticResponses[path]];

		// Collections: /api/v3/<collection>[/<id>]
		const match = path.match(
			/^\/api\/v3\/(customformat|qualityprofile|delayprofile|tag)(?:\/(\d+))?$/
		);
		if (match) {
			const collection = match[1] as Collection;
			const store = collections[collection];
			const id = match[2] ? Number(match[2]) : null;
			if (id === null) {
				if (method === 'GET') return [200, store];
				if (method === 'POST') {
					const rejected = rejection(collection, body);
					if (rejected)
						return [rejected.status, [{ propertyName: 'Name', errorMessage: 'Rejected by test' }]];
					const created = { ...(body as Resource), id: nextId(store) };
					store.push(created);
					return [201, created];
				}
				return null;
			}
			const index = store.findIndex((item) => item.id === id);
			if (index === -1) return [404, { message: 'NotFound' }];
			if (method === 'GET') return [200, store[index]];
			if (method === 'PUT') {
				const rejected = rejection(collection, body);
				if (rejected)
					return [rejected.status, [{ propertyName: 'Name', errorMessage: 'Rejected by test' }]];
				store[index] = { ...(body as Resource), id };
				return [202, store[index]];
			}
			if (method === 'DELETE') {
				store.splice(index, 1);
				return [200, {}];
			}
			return null;
		}

		if (path === `${API}/qualitydefinition`) {
			return method === 'GET' ? [200, qualityDefinitions] : null;
		}
		if (method === 'PUT' && path === `${API}/qualitydefinition/update`) {
			for (const update of (body as Resource[]) ?? []) {
				const index = qualityDefinitions.findIndex((item) => item.id === update.id);
				if (index !== -1) qualityDefinitions[index] = { ...qualityDefinitions[index], ...update };
			}
			return [202, qualityDefinitions];
		}

		// Single-object settings: GET /config/<name>, PUT /config/<name>/<id>
		const config = path.match(/^\/api\/v3\/config\/(naming|mediamanagement)(?:\/(\d+))?$/);
		if (config) {
			const key = config[1] === 'naming' ? 'naming' : 'mediaManagement';
			if (method === 'GET' && !config[2]) return [200, fake[key]];
			if (method === 'PUT' && config[2]) {
				fake[key] = { ...(body as Resource), id: Number(config[2]) };
				return [202, fake[key]];
			}
			return null;
		}

		if (method === 'POST' && path === `${API}/command`) {
			return [201, { id: 1, name: (body as Resource | null)?.name, status: 'completed' }];
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
		const key = req.headers['x-api-key'] ?? url.searchParams.get('apikey');
		const failure = failures.find((f) => f.method === method && f.path === url.pathname);
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
	}

	const port = await freePort();
	const server = createServer((req, res) => void handle(req, res));
	await new Promise<void>((resolveListen) => server.listen(port, '127.0.0.1', resolveListen));

	return {
		type,
		url: `http://127.0.0.1:${port}`,
		apiKey,
		requests,
		unhandled,
		collections,
		qualityDefinitions,
		get naming() {
			return fake.naming;
		},
		get mediaManagement() {
			return fake.mediaManagement;
		},
		sent: (method, path) =>
			requests.filter((r) => r.method === method && r.path === path).map((r) => r.body),
		reject: (collection, name, status = 400) => void rejections.push({ collection, name, status }),
		fail: (method, path, status) => void failures.push({ method, path, status }),
		stop: () => new Promise<void>((resolveStop) => server.close(() => resolveStop()))
	};
}
