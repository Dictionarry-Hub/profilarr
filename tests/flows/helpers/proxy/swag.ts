/**
 * SWAG's real nginx and shipped proxy.conf include, run without its certificate
 * automation. The test supplies its own certificate and a dynamic listen port,
 * while SWAG supplies the proxy header behavior users receive.
 */
import * as fs from 'node:fs/promises';
import { join } from 'node:path';
import { serviceDir, startService, waitForService, type Service } from '#flows/harness/docker.ts';
import { serviceImage } from '#flows/harness/images.ts';
import { freePort } from '#flows/harness/ports.ts';
import { certificatePaths, httpsGet } from '#flows/harness/tls.ts';
import {
	answeredByApp,
	type ProxyOptions,
	type ReverseProxy,
	type RunningProxy
} from './proxies.ts';

async function startSwag(options: ProxyOptions): Promise<RunningProxy> {
	if (
		!options.tls ||
		options.forwardAuth ||
		options.headers ||
		options.maxResponseHeaderBytes !== undefined
	) {
		throw new Error('SWAG origin flows require TLS and only support publicHost');
	}

	const port = await freePort();
	const url = `https://${options.publicHost ?? '127.0.0.1'}:${port}`;
	let service: Service | null = null;

	async function launch(appUrl: string): Promise<void> {
		const dir = await serviceDir();
		const tls = certificatePaths();
		await fs.copyFile(tls.cert, join(dir.path, 'cert.pem'));
		await fs.copyFile(tls.key, join(dir.path, 'key.pem'));

		const config = `
worker_processes 1;
error_log /dev/stderr info;
pid /tmp/nginx.pid;

events { worker_connections 128; }

http {
  map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
  }
  # proxy.conf reads $request_port and $is_request_port, which SWAG's nginx
  # build defines itself

  access_log /dev/stdout;
  server {
    listen 127.0.0.1:${port} ssl;
    ssl_certificate /data/cert.pem;
    ssl_certificate_key /data/key.pem;

    location / {
      include /defaults/nginx/proxy.conf.sample;
      proxy_pass ${appUrl};
      proxy_buffering off;
    }
  }
}
`;
		await fs.writeFile(join(dir.path, 'nginx.conf'), config);

		service = await startService({
			image: serviceImage('swag'),
			entrypoint: ['/bin/sh'],
			cmd: ['-c', 'nginx -c /data/nginx.conf -g "daemon off;"'],
			binds: [`${dir.hostPath}:/data:ro`]
		});
		await waitForService(service, 'SWAG', async () =>
			answeredByApp((await httpsGet(`${url}/api/v1/health`)).status)
		);
	}

	return {
		proxy: swag,
		url,
		target: async (appUrl) => {
			if (service) throw new Error('SWAG already forwards to an app; it takes one per test');
			await launch(appUrl);
		},
		requests: [],
		fail: () => {
			throw new Error("SWAG can't fail on purpose; use the fake proxy");
		},
		logs: async () => (service ? await service.logs() : 'SWAG never started'),
		stop: async () => {
			await service?.stop();
		}
	};
}

export const swag: ReverseProxy = {
	id: 'swag',
	label: 'SWAG',
	needsDocker: true,
	originOnly: true,
	supports: ['tls'],
	start: startSwag
};
