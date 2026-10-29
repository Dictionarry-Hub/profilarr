import type { RequestHandler } from '@sveltejs/kit';
import { createArrClient } from '#arr/factory.ts';
import { recordDetectedVersion } from '#arr/version.ts';
import type { ArrType, ArrVersionInfo } from '#arr/types.ts';
import { arrInstancesQueries } from '#db/queries/arrInstances.ts';
import { HtmlResponseError } from '#utils/http/types.ts';
import { logger } from '#logger/logger.ts';
import { normalizeArrInstanceUrl } from '#shared/utils/arrUrl.ts';

const VALID_TYPES = ['radarr', 'sonarr'];

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { type, url, apiKey, instanceId, basicAuthUsername, basicAuthPassword } =
			await request.json();

		// Validation
		if (!type || !url || !apiKey) {
			return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		if (!VALID_TYPES.includes(type)) {
			return Response.json({ success: false, error: 'Invalid arr type' }, { status: 400 });
		}

		// An existing instance (edit mode) gets the result stored on its row
		const existing =
			typeof instanceId === 'number' ? arrInstancesQueries.getById(instanceId) : undefined;

		// Create client and probe (3 second timeout, no retries for quick feedback)
		// Blank Basic Auth fields keep what an existing instance has saved, but only for
		// its own URL, so saved credentials never go to a new address
		const useSavedBasicAuth =
			!!existing &&
			!basicAuthUsername &&
			!basicAuthPassword &&
			normalizeArrInstanceUrl(url) === normalizeArrInstanceUrl(existing.url);
		const client = createArrClient(type as ArrType, url, apiKey, {
			timeout: 3000,
			retries: 0,
			basicAuthUsername: useSavedBasicAuth ? existing.basic_auth_username : basicAuthUsername,
			basicAuthPassword: useSavedBasicAuth ? existing.basic_auth_password : basicAuthPassword
		});
		let info: ArrVersionInfo | null = null;
		let failure = 'Connection test failed';
		try {
			info = await client.detectVersion();
		} catch (error) {
			await logger.error(`Connection failed to ${url}`, {
				source: 'arr/validate',
				meta: { error: error instanceof Error ? error.message : String(error) }
			});
			// A web page instead of the API is worth naming; other failures stay generic
			if (error instanceof HtmlResponseError) failure = error.message;
		}

		if (info) {
			if (existing) await recordDetectedVersion(existing, info, 'arr/validate');
			return Response.json({
				success: true,
				appName: info.appName,
				version: info.version,
				api: info.currentApi
			});
		}
		return Response.json({ success: false, error: failure }, { status: 400 });
	} catch (error) {
		return Response.json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Unknown error'
			},
			{ status: 500 }
		);
	}
};
