import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createArrClient } from '$arr/factory.ts';
import { probeAndRecordVersion } from '$arr/version.ts';
import type { ArrType, ArrVersionInfo } from '$arr/types.ts';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { logger } from '$logger/logger.ts';

const VALID_TYPES = ['radarr', 'sonarr'];

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { type, url, apiKey, instanceId } = await request.json();

		// Validation
		if (!type || !url || !apiKey) {
			return json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		if (!VALID_TYPES.includes(type)) {
			return json({ success: false, error: 'Invalid arr type' }, { status: 400 });
		}

		// An existing instance (edit mode) gets the result stored on its row
		const existing =
			typeof instanceId === 'number' ? arrInstancesQueries.getById(instanceId) : undefined;

		// Create client and probe (3 second timeout, no retries for quick feedback)
		const client = createArrClient(type as ArrType, url, apiKey, { timeout: 3000, retries: 0 });
		let info: ArrVersionInfo | null;
		try {
			if (existing) {
				info = await probeAndRecordVersion(existing, client, 'arr/validate');
			} else {
				info = await client.detectVersion();
			}
		} catch (error) {
			await logger.error(`Connection failed to ${url}`, {
				source: 'arr/validate',
				meta: { error: error instanceof Error ? error.message : String(error) }
			});
			info = null;
		} finally {
			client.close();
		}

		if (info) {
			return json({
				success: true,
				appName: info.appName,
				version: info.version,
				api: info.currentApi
			});
		}
		return json({ success: false, error: 'Connection test failed' }, { status: 400 });
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
