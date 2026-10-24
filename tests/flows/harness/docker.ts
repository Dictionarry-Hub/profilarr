/**
 * Run a real service, such as Traefik or Authelia, next to a flow test.
 *
 * A service is a container that shares the test container's network
 * namespace. It reaches the app on 127.0.0.1, and the browser reaches it on
 * 127.0.0.1. The test container has no network, so neither does the service.
 *
 * This talks to the Docker Engine API over the socket that `deno task flows`
 * mounts when the host has one; the image has no Docker CLI. Without the
 * socket, `dockerAvailable()` is false and specs skip real services.
 */

import { request } from 'node:http';
import * as fs from 'node:fs/promises';
import { hostname } from 'node:os';
import { join, relative } from 'node:path';
import { randomUUID } from 'node:crypto';

const SOCKET = '/var/run/docker.sock';
/** Label on every service container, with this run's id, so teardown can find leftovers */
const RUN_LABEL = 'profilarr-flows-run';
/** Environment variable holding this run's id */
export const RUN_ID_ENV = 'FLOWS_RUN_ID';
/** Where service config folders live, under the repo so the host can bind-mount them */
const SERVICES_DIR = 'tests/flows/.services';

/** True when the run can start containers: `deno task flows` mounted the Docker socket */
export function dockerAvailable(): boolean {
	return process.env.FLOWS_DOCKER === '1';
}

function runId(): string {
	const id = process.env[RUN_ID_ENV];
	if (!id) throw new Error(`${RUN_ID_ENV} isn't set; global setup sets it`);
	return id;
}

interface ApiResponse {
	status: number;
	body: Buffer;
}

function api(method: string, path: string, body?: unknown): Promise<ApiResponse> {
	return new Promise((resolveApi, rejectApi) => {
		const payload = body === undefined ? undefined : JSON.stringify(body);
		const req = request(
			{
				socketPath: SOCKET,
				method,
				path,
				headers: payload
					? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
					: {}
			},
			(res) => {
				const chunks: Buffer[] = [];
				res.on('data', (chunk: Buffer) => chunks.push(chunk));
				res.on('end', () =>
					resolveApi({ status: res.statusCode ?? 0, body: Buffer.concat(chunks) })
				);
			}
		);
		req.on('error', rejectApi);
		if (payload) req.write(payload);
		req.end();
	});
}

async function expectOk(response: ApiResponse, what: string): Promise<void> {
	if (response.status >= 300) {
		throw new Error(
			`Docker couldn't ${what} (${response.status}): ${response.body.toString('utf8')}`
		);
	}
}

/** Docker's log stream frames each chunk with an 8-byte header; keep the text */
function demultiplex(raw: Buffer): string {
	const parts: string[] = [];
	let offset = 0;
	while (offset + 8 <= raw.length) {
		const size = raw.readUInt32BE(offset + 4);
		parts.push(raw.subarray(offset + 8, offset + 8 + size).toString('utf8'));
		offset += 8 + size;
	}
	return parts.join('');
}

/**
 * A folder for one service's config files. It sits under the repo, which
 * the host mounts at the same relative path, so the service can bind-mount
 * it. `hostPath` is that folder's path on the host.
 */
export async function serviceDir(): Promise<{ path: string; hostPath: string }> {
	const host = process.env.FLOWS_HOST_ROOT;
	if (!host)
		throw new Error("FLOWS_HOST_ROOT isn't set; deno task flows sets it with the Docker socket");
	const path = join(process.cwd(), SERVICES_DIR, runId(), randomUUID());
	await fs.mkdir(path, { recursive: true });
	return { path, hostPath: join(host, relative(process.cwd(), path)) };
}

export interface ServiceSpec {
	/** A pinned image, from serviceImage() in harness/images.ts */
	image: string;
	cmd?: string[];
	env?: Record<string, string>;
	/** `<host path>:<container path>[:ro]` */
	binds?: string[];
	/** Run as this user, e.g. the host user so files it writes stay readable */
	user?: string;
}

export interface Service {
	id: string;
	/** Everything the container has printed so far */
	logs(): Promise<string>;
	/** False once the container has exited, e.g. on a config error */
	running(): Promise<boolean>;
	stop(): Promise<void>;
}

const READY_TIMEOUT_MS = 30_000;

/** Start a service container in this test container's network namespace */
export async function startService(spec: ServiceSpec): Promise<Service> {
	const created = await api('POST', '/containers/create', {
		Image: spec.image,
		Cmd: spec.cmd,
		Env: Object.entries(spec.env ?? {}).map(([name, value]) => `${name}=${value}`),
		User: spec.user,
		Labels: { [RUN_LABEL]: runId() },
		HostConfig: {
			// The test container's hostname is its container id
			NetworkMode: `container:${hostname()}`,
			Binds: spec.binds ?? []
		}
	});
	await expectOk(created, `create a ${spec.image} container`);
	const { Id: id } = JSON.parse(created.body.toString('utf8')) as { Id: string };
	await expectOk(await api('POST', `/containers/${id}/start`), `start ${spec.image}`);

	return {
		id,
		logs: async () =>
			demultiplex((await api('GET', `/containers/${id}/logs?stdout=1&stderr=1`)).body),
		running: async () => {
			const inspected = await api('GET', `/containers/${id}/json`);
			const { State } = JSON.parse(inspected.body.toString('utf8')) as {
				State: { Running: boolean };
			};
			return State.Running;
		},
		stop: async () => {
			await api('DELETE', `/containers/${id}?force=1`);
		}
	};
}

/**
 * Wait until `check` answers true, polling. Fails as soon as the container
 * exits, or after 30 seconds, with everything the container printed.
 */
export async function waitForService(
	service: Service,
	what: string,
	check: () => Promise<boolean>
): Promise<void> {
	const deadline = Date.now() + READY_TIMEOUT_MS;
	while (Date.now() < deadline) {
		try {
			if (await check()) return;
		} catch {
			// Not answering yet
		}
		if (!(await service.running())) {
			throw new Error(`${what} exited before it was ready:\n${await service.logs()}`);
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	throw new Error(`${what} wasn't ready after ${READY_TIMEOUT_MS}ms:\n${await service.logs()}`);
}

/** Remove every service container this run left behind */
export async function removeRunServices(): Promise<void> {
	if (!dockerAvailable()) return;
	const filters = encodeURIComponent(JSON.stringify({ label: [`${RUN_LABEL}=${runId()}`] }));
	const listed = await api('GET', `/containers/json?all=1&filters=${filters}`);
	const containers = JSON.parse(listed.body.toString('utf8')) as { Id: string }[];
	await Promise.all(containers.map((c) => api('DELETE', `/containers/${c.Id}?force=1`)));
}
