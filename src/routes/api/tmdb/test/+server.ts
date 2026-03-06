import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { TMDBClient } from '$lib/server/utils/tmdb/client.ts';
import { tmdbSettingsQueries } from '$db/queries/tmdbSettings.ts';

export const POST: RequestHandler = async ({ request }) => {
	const { apiKey: providedKey } = await request.json();
	const apiKey = providedKey || tmdbSettingsQueries.get()?.api_key;

	if (!apiKey) {
		return json({ success: false, error: 'API key is required' }, { status: 400 });
	}

	try {
		const client = new TMDBClient(apiKey);
		const result = await client.validateKey();

		if (result.success) {
			return json({ success: true });
		} else {
			return json({ success: false, error: result.status_message }, { status: 400 });
		}
	} catch (error) {
		return json(
			{
				success: false,
				error: error instanceof Error ? error.message : 'Connection failed'
			},
			{ status: 400 }
		);
	}
};
