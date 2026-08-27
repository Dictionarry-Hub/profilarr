/**
 * Startup banner and logging
 */

import { config } from '$config';
import { build } from '$lib/shared/build.ts';
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

export function printBanner(): void {
	const version = build.version;
	const url = `${config.serverUrl}${config.baseUrl}`;

	console.log(BANNER);
	console.log(`  v${version}  |  ${url}`);
	console.log();
}

export interface ServerInfo {
	version: string;
	env: string;
	timezone: string;
	basePath: string;
	baseUrl: string;
	hostname: string;
}

export function getServerInfo(): ServerInfo {
	return {
		version: build.version,
		env: Deno.env.get('DENO_ENV') || 'production',
		timezone: config.timezone,
		basePath: config.paths.base,
		baseUrl: config.baseUrl || '/',
		hostname: typeof Deno !== 'undefined' ? Deno.hostname() : 'unknown'
	};
}
