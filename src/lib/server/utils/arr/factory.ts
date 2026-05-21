import type { ArrType } from './types.ts';
import { BaseArrClient, type ArrClientOptions } from './base.ts';
import { RadarrClient } from './clients/radarr.ts';
import { SonarrClient } from './clients/sonarr.ts';
import { LidarrClient } from './clients/lidarr.ts';
import { ChaptarrClient } from './clients/chaptarr.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';

/**
 * Factory function to create an arr client instance
 * @param type - The arr application type (radarr, sonarr, lidarr, chaptarr)
 * @param url - Base URL of the arr instance
 * @param apiKey - API key for authentication
 * @param options - Optional client options (timeout, etc.)
 * @returns Arr client instance
 */
export function createArrClient(
	type: ArrType,
	url: string,
	apiKey: string,
	options?: ArrClientOptions
): BaseArrClient {
	switch (type) {
		case 'radarr':
			return new RadarrClient(url, apiKey, options);
		case 'sonarr':
			return new SonarrClient(url, apiKey, options);
		case 'lidarr':
			return new LidarrClient(url, apiKey, options);
		case 'chaptarr':
			return new ChaptarrClient(url, apiKey, options);
		default:
			throw new Error(`Unknown arr type: ${type}`);
	}
}

export function arrClientOptionsFromInstance(
	instance: Pick<ArrInstance, 'basic_auth_username' | 'basic_auth_password'>,
	options?: ArrClientOptions
): ArrClientOptions {
	return {
		...options,
		basicAuthUsername: instance.basic_auth_username,
		basicAuthPassword: instance.basic_auth_password
	};
}
