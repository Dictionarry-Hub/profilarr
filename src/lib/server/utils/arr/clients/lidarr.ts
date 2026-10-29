import { BaseArrClient } from '#arr/base.ts';

/**
 * Lidarr API client
 * Extends BaseArrClient with Lidarr-specific API methods
 * Note: Lidarr uses API v1, not v3 like other *arr apps
 */
export class LidarrClient extends BaseArrClient {
	protected override apiVersion: string = 'v1'; // Lidarr uses v1 API

	// Specific API methods will be implemented here as needed
}
