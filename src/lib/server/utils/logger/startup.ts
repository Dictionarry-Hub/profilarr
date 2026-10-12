/**
 * Startup banner and logging
 */

import { readFileSync, statSync } from 'node:fs';
import { hostname } from 'node:os';
import process from 'node:process';
import { config } from '$config';
import { build } from '#lib/shared/build.ts';
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
		statSync('/.dockerenv');
		return true;
	} catch {
		// Check for docker in cgroup (fallback)
		try {
			const cgroup = readFileSync('/proc/1/cgroup', 'utf8');
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
			puid: process.env.PUID || '1000',
			pgid: process.env.PGID || '1000',
			umask: process.env.UMASK || '022',
			tz: process.env.TZ || 'UTC'
		}
	});
}

/**
 * Log outbound proxy settings (only when a proxy variable is set).
 * Credentials are never logged.
 */
export async function logProxyConfig(): Promise<void> {
	const { proxies, noProxy } = getProxyEnv();
	if (Object.keys(proxies).length === 0) return;

	await logger.info('Outbound proxy configured', {
		source: 'utils.logger.startup',
		meta: { proxies, noProxy }
	});

	for (const [variable, url] of Object.entries(proxies)) {
		if (url === null) {
			await logger.warn(`${variable} is not a valid proxy URL`, {
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
		env: process.env.DENO_ENV || 'production',
		timezone: config.timezone,
		basePath: config.paths.base,
		hostname: hostname()
	};
}
