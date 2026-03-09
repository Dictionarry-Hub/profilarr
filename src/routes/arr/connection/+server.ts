import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { createArrClient } from '$arr/factory.ts';
import type { ArrType } from '$arr/types.ts';

const VALID_TYPES = ['radarr', 'sonarr'];

export const POST: RequestHandler = async ({ request }) => {
	try {
		const { type, url, apiKey } = await request.json();

		// Validation
		if (!type || !url || !apiKey) {
			return json({ success: false, error: 'Missing required fields' }, { status: 400 });
		}

		if (!VALID_TYPES.includes(type)) {
			return json({ success: false, error: 'Invalid arr type' }, { status: 400 });
		}

		// Create client and test connection (3 second timeout, no retries for quick feedback)
		const client = createArrClient(type as ArrType, url, apiKey, { timeout: 3000, retries: 0 });
		const isConnected = await client.testConnection();
		client.close();

		if (isConnected) {
			return json({ success: true });
		} else {
			return json({ success: false, error: 'Connection test failed' }, { status: 400 });
		}
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
