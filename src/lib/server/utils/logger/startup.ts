/**
 * Startup banner and logging
 */

import { config } from '$config';
import { build } from '$lib/shared/build.ts';
import { getProxyEnv } from '$http/proxy.ts';
import { logger } from './logger.ts';

const BANNER = String.raw`
                     _____.__.__
_____________  _____/ ____\__|  | _____ ______________
\____ \_  __ \/  _ \   __\|  |  | \__  \\_  __ \_  __ \
|  |_> >  | \(  <_> )  |  |  |  |__/ __ \|  | \/|  | \/
|   __/|__|   \____/|__|  |__|____(____  /__|   |__|
|__|                                   \/
`;

/**
 * Check if running inside a Docker container
 */
function isDocker(): boolean {
	try {
		// Check for .dockerenv file (most reliable)
		Deno.statSync('/.dockerenv');
		return true;
	} catch {
		// Check for docker in cgroup (fallback)
		try {
			const cgroup = Deno.readTextFileSync('/proc/1/cgroup');
			return cgroup.includes('docker');
		} catch {
			return false;
		}
	}
}

/**
 * Log container configuration (only when running in Docker)
 */
export async function logContainerConfig(): Promise<void> {
	if (!isDocker()) return;

	await logger.info('Container initialized', {
		source: 'Docker',
		meta: {
			puid: Deno.env.get('PUID') || '1000',
			pgid: Deno.env.get('PGID') || '1000',
			umask: Deno.env.get('UMASK') || '022',
			tz: Deno.env.get('TZ') || 'UTC'
		}
	});
}

/**
 * Log outbound proxy settings (only when a proxy variable is set).
 * Credentials are never logged.
 */
export async function logProxyConfig(): Promise<void> {
	const { proxies, noProxy } = getProxyEnv();
	if (proxies.length === 0) return;

	await logger.info('Outbound proxy configured', {
		source: 'utils.logger.startup',
		meta: { proxies, noProxy }
	});

	for (const proxy of proxies) {
		if (proxy.url === null) {
			await logger.warn(`${proxy.variable} is not a valid proxy URL`, {
				source: 'utils.logger.startup'
			});
		}
	}

	if (noProxy.length === 0) {
		await logger.warn('NO_PROXY is not set; Arr and parser requests may also use the proxy', {
			source: 'utils.logger.startup'
		});
	}
}

export function printBanner(): void {
	const version = build.version;
	const url = config.serverUrl;

	console.log(BANNER);
	console.log(`  v${version}  |  ${url}`);
	console.log();
}

export interface ServerInfo {
	version: string;
	env: string;
	timezone: string;
	basePath: string;
	hostname: string;
}

export function getServerInfo(): ServerInfo {
	return {
		version: build.version,
		env: Deno.env.get('DENO_ENV') || 'production',
		timezone: config.timezone,
		basePath: config.paths.base,
		hostname: typeof Deno !== 'undefined' ? Deno.hostname() : 'unknown'
	};
}
