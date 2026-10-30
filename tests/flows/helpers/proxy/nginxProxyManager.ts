/**
 * Nginx Proxy Manager with a proxy host created through its API. This keeps
 * coverage on the manager-generated nginx configuration rather than treating
 * the image as another raw nginx binary.
 */
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { serviceImage } from '#flows/harness/images.ts';
import { serviceDir, startService, waitForService } from '#flows/harness/docker.ts';
import { certificatePaths, httpsGet } from '#flows/harness/tls.ts';
import {
	answeredByApp,
	type ProxyOptions,
	type ReverseProxy,
	type RunningProxy
} from './proxies.ts';

const ADMIN_EMAIL = 'flows@example.com';
const ADMIN_PASSWORD = 'flows-npm-password';
const API = 'http://127.0.0.1:81/api';

async function json<T>(url: string, init?: RequestInit): Promise<T> {
	const response = await fetch(url, init);
	if (!response.ok) {
		throw new Error(
			`Nginx Proxy Manager ${url} answered ${response.status}: ${await response.text()}`
		);
	}
	return (await response.json()) as T;
}

async function startNginxProxyManager(options: ProxyOptions): Promise<RunningProxy> {
	if (
		!options.tls ||
		options.forwardAuth ||
		options.headers ||
		options.maxResponseHeaderBytes !== undefined
	) {
		throw new Error('Nginx Proxy Manager origin flows require TLS and only support publicHost');
	}
	const publicHost = options.publicHost ?? '127.0.0.1';
	const url = `https://${publicHost}`;
	// Its entrypoint exits unless /data and /etc/letsencrypt are mounted. It
	// creates these folders as root before it drops to PUID, and only chowns a
	// mount whose owner differs from PUID, so make them all here as that user.
	const dir = await serviceDir();
	await Promise.all(
		[
			'letsencrypt',
			'data/custom_ssl',
			'data/logs',
			'data/access',
			'data/letsencrypt-acme-challenge',
			...[
				'default_host',
				'default_www',
				'proxy_host',
				'redirection_host',
				'stream',
				'dead_host',
				'temp'
			].map((name) => `data/nginx/${name}`)
		].map((path) => fs.mkdir(join(dir.path, path), { recursive: true }))
	);
	const service = await startService({
		image: serviceImage('nginxProxyManager'),
		env: {
			DISABLE_IPV6: 'true',
			// Fixed first admin instead of the generated one printed to the log
			INITIAL_ADMIN_EMAIL: ADMIN_EMAIL,
			INITIAL_ADMIN_PASSWORD: ADMIN_PASSWORD,
			// Own what it writes to the bind mounts, so the run can clean them up
			PUID: String(process.getuid?.() ?? 1000),
			PGID: String(process.getgid?.() ?? 1000),
			// No certificates are issued here; the chown of certbot takes seconds
			SKIP_CERTBOT_OWNERSHIP: 'true'
		},
		binds: [
			`${join(dir.hostPath, 'data')}:/data`,
			`${join(dir.hostPath, 'letsencrypt')}:/etc/letsencrypt`
		]
	});
	// nginx's errors and the generated host config go to files under /data,
	// not the container log
	async function logs(): Promise<string> {
		const read = async (relative: string): Promise<string[]> => {
			const folder = join(dir.path, relative);
			const files = await fs.readdir(folder).catch(() => [] as string[]);
			return Promise.all(
				files.map(
					async (file) =>
						`--- ${relative}/${file}\n${await fs.readFile(join(folder, file), 'utf8')}`
				)
			);
		};
		return [
			await service.logs(),
			...(await read('data/logs')),
			...(await read('data/nginx/proxy_host'))
		].join('\n');
	}
	const observed = { ...service, logs };
	await waitForService(observed, 'Nginx Proxy Manager', async () => {
		const response = await fetch(`${API}/`);
		return response.ok;
	});

	async function launch(appUrl: string): Promise<void> {
		const tokenResponse = await json<{ token: string }>(`${API}/tokens`, {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({ identity: ADMIN_EMAIL, secret: ADMIN_PASSWORD })
		});
		const authorization = { Authorization: `Bearer ${tokenResponse.token}` };

		const certificate = await json<{ id: number }>(`${API}/nginx/certificates`, {
			method: 'POST',
			headers: { ...authorization, 'content-type': 'application/json' },
			body: JSON.stringify({
				provider: 'other',
				nice_name: 'Profilarr flow certificate',
				domain_names: ['localhost', '127.0.0.1'],
				meta: {}
			})
		});
		const tls = certificatePaths();
		const upload = new FormData();
		upload.set('certificate', new Blob([await fs.readFile(tls.cert)]), 'cert.pem');
		upload.set('certificate_key', new Blob([await fs.readFile(tls.key)]), 'key.pem');
		const uploaded = await fetch(`${API}/nginx/certificates/${certificate.id}/upload`, {
			method: 'POST',
			headers: authorization,
			body: upload
		});
		if (!uploaded.ok) {
			throw new Error(`Nginx Proxy Manager certificate upload failed: ${await uploaded.text()}`);
		}

		const target = new URL(appUrl);
		await json(`${API}/nginx/proxy-hosts`, {
			method: 'POST',
			headers: { ...authorization, 'content-type': 'application/json' },
			body: JSON.stringify({
				domain_names: [publicHost],
				forward_scheme: target.protocol.slice(0, -1),
				forward_host: target.hostname,
				forward_port: Number(target.port),
				access_list_id: 0,
				certificate_id: certificate.id,
				ssl_forced: false,
				caching_enabled: false,
				block_exploits: false,
				advanced_config: '',
				meta: {},
				allow_websocket_upgrade: true,
				http2_support: false,
				hsts_enabled: false,
				hsts_subdomains: false,
				trust_forwarded_proto: false,
				locations: []
			})
		});
		await waitForService(observed, 'Nginx Proxy Manager host', async () =>
			answeredByApp((await httpsGet(`${url}/api/v1/health`)).status)
		);
	}

	return {
		proxy: nginxProxyManager,
		url,
		target: launch,
		requests: [],
		fail: () => {
			throw new Error("Nginx Proxy Manager can't fail on purpose; use the fake proxy");
		},
		logs,
		stop: () => service.stop()
	};
}

export const nginxProxyManager: ReverseProxy = {
	id: 'nginx-proxy-manager',
	label: 'Nginx Proxy Manager',
	needsDocker: true,
	originOnly: true,
	supports: ['tls'],
	start: startNginxProxyManager
};
