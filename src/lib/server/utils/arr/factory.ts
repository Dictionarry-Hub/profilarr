import type { ArrType } from './types.ts';
import { BaseArrClient, type ArrClientOptions } from './base.ts';
import { RadarrClient } from './clients/radarr.ts';
import { SonarrClient } from './clients/sonarr.ts';
import { LidarrClient } from './clients/lidarr.ts';
import { ChaptarrClient } from './clients/chaptarr.ts';

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
