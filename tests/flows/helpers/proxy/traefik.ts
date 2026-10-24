/**
 * Traefik as the reverse proxy, running in a container next to the test
 * (harness/docker.ts). Its tests are the scenarios that run behind it through
 * `proxySetups()` in proxies.ts.
 *
 * The container starts in `target()`, once the app's address is known, with
 * one file-provider route from every path to the app. Over HTTPS it serves
 * the run's certificate as the default, because browsers send no server name
 * for an IP address. `requests` reads Traefik's JSON access log.
 *
 * With `forwardAuth`, every request first goes to the SSO provider's
 * forward-auth endpoint, as in Authelia's Traefik guide. Traefik trusts the
 * run's certificate for that call.
 *
 * The dynamic config is JSON, which Traefik reads as YAML.
 */

import { existsSync, readFileSync } from 'node:fs';
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { serviceDir, startService, waitForService, type Service } from '$flows/harness/docker.ts';
import { serviceImage } from '$flows/harness/images.ts';
import { freePort } from '$flows/harness/ports.ts';
import { certificatePaths, httpsGet } from '$flows/harness/tls.ts';
import type {
	ProxiedRequest,
	ProxyOptions,
	ReverseProxy,
	RunningProxy
} from '$flows/helpers/proxy/proxies.ts';

/** One line of Traefik's JSON access log, the fields read here */
interface AccessLogEntry {
	RequestMethod?: string;
	RequestPath?: string;
	DownstreamStatus?: number;
	[field: string]: unknown;
}

function readAccessLog(path: string): ProxiedRequest[] {
	if (!existsSync(path)) return [];
	return readFileSync(path, 'utf8')
		.split('\n')
		.filter((line) => line.trim() !== '')
		.map((line) => {
			const entry = JSON.parse(line) as AccessLogEntry;
			// Traefik logs each header it received as `request_<Name>`
			const headers: Record<string, string> = {};
			for (const [field, value] of Object.entries(entry)) {
				if (field.startsWith('request_') && typeof value === 'string') {
					headers[field.slice('request_'.length).toLowerCase()] = value;
				}
			}
			return {
				method: entry.RequestMethod ?? '',
				path: entry.RequestPath ?? '',
				headers,
				status: entry.DownstreamStatus ?? 0
			};
		});
}

async function startTraefik(options: ProxyOptions, forwardAuthUrl?: string): Promise<RunningProxy> {
	const unsupported = (['headers', 'maxResponseHeaderBytes'] as const).filter(
		(option) => options[option] !== undefined
	);
	if (unsupported.length > 0) {
		throw new Error(`Traefik doesn't support ${unsupported.join(', ')}; use the fake proxy`);
	}
	if (options.forwardAuth && !forwardAuthUrl) {
		throw new Error("Forward auth needs the SSO provider's forward-auth endpoint");
	}

	const port = await freePort();
	const url = `${options.tls ? 'https' : 'http'}://127.0.0.1:${port}`;
	let service: Service | null = null;
	let accessLog: string | null = null;

	/** Write the route to `appUrl` and start Traefik */
	async function launch(appUrl: string): Promise<void> {
		const dir = await serviceDir();
		await fs.mkdir(join(dir.path, 'dynamic'));
		if (options.tls || options.forwardAuth) {
			const tls = certificatePaths();
			await fs.copyFile(tls.cert, join(dir.path, 'cert.pem'));
			await fs.copyFile(tls.key, join(dir.path, 'key.pem'));
		}
		const dynamic = {
			http: {
				routers: {
					app: {
						rule: 'PathPrefix(`/`)',
						entryPoints: ['web'],
						service: 'app',
						middlewares: options.forwardAuth ? ['forward-auth'] : undefined,
						tls: options.tls ? {} : undefined
					}
				},
				middlewares: options.forwardAuth
					? {
							'forward-auth': {
								forwardAuth: {
									address: forwardAuthUrl,
									trustForwardHeader: true,
									authResponseHeaders: [
										'Remote-User',
										'Remote-Groups',
										'Remote-Email',
										'Remote-Name'
									],
									tls: { ca: '/data/cert.pem' }
								}
							}
						}
					: undefined,
				services: { app: { loadBalancer: { servers: [{ url: appUrl }] } } }
			},
			tls: options.tls
				? {
						stores: {
							default: {
								defaultCertificate: { certFile: '/data/cert.pem', keyFile: '/data/key.pem' }
							}
						}
					}
				: undefined
		};
		await fs.writeFile(join(dir.path, 'dynamic', 'app.yml'), JSON.stringify(dynamic, null, 2));
		accessLog = join(dir.path, 'access.log');

		service = await startService({
			image: serviceImage('traefik'),
			cmd: [
				`--entryPoints.web.address=127.0.0.1:${port}`,
				'--providers.file.directory=/data/dynamic',
				'--accessLog.filePath=/data/access.log',
				'--accessLog.format=json',
				'--accessLog.fields.headers.defaultMode=keep',
				'--log.level=INFO',
				// The container has no network
				'--global.checkNewVersion=false',
				'--global.sendAnonymousUsage=false'
			],
			binds: [`${dir.hostPath}:/data`],
			// The access log stays the host user's, so teardown can remove it
			user: `${process.getuid?.() ?? 1000}:${process.getgid?.() ?? 1000}`
		});
		const health = `${url}/api/v1/health`;
		await waitForService(service, 'Traefik', async () => {
			const status = options.tls
				? (await httpsGet(health)).status
				: (await fetch(health, { redirect: 'manual' })).status;
			// With forward auth, a signed-out request gets the provider's answer, a
			// redirect or 401, once Traefik and the provider are both up
			return options.forwardAuth ? status !== 404 && status < 500 : status === 200;
		});
	}

	return {
		proxy: traefik,
		url,
		target: async (appUrl) => {
			if (service) throw new Error('Traefik already forwards to an app; it takes one per test');
			await launch(appUrl);
		},
		get requests(): ProxiedRequest[] {
			return accessLog ? readAccessLog(accessLog) : [];
		},
		fail: () => {
			throw new Error("Traefik can't fail on purpose; use the fake proxy");
		},
		logs: async () => (service ? await service.logs() : 'Traefik never started'),
		stop: async () => {
			await service?.stop();
		}
	};
}

export const traefik: ReverseProxy = {
	id: 'traefik',
	label: 'Traefik',
	needsDocker: true,
	supports: ['tls', 'forwardAuth'],
	start: startTraefik
};
