import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { getDiff } from '$utils/git/index.ts';
import { validateFilePaths } from '$utils/paths.ts';
import { isAIEnabled, generateCommitMessage } from '$utils/ai/client.ts';

export const POST: RequestHandler = async ({ params, request }) => {
	if (!isAIEnabled()) {
		error(503, 'AI is not configured. Enable it in Settings > General.');
	}

	const id = parseInt(params.id || '', 10);
	const database = databaseInstancesQueries.getById(id);

	if (!database) {
		error(404, 'Database not found');
	}

	const body = await request.json();
	const files = body.files as string[] | undefined;

	if (files && files.length > 0) {
		try {
			validateFilePaths(database.local_path, files);
		} catch {
			error(400, 'Invalid file path');
		}
	}

	const diff = await getDiff(database.local_path, files);

	if (!diff.trim()) {
		error(400, 'No changes to generate message for');
	}

	try {
		const message = await generateCommitMessage(diff);
		return json({ message });
	} catch (err) {
		error(500, err instanceof Error ? err.message : 'Failed to generate commit message');
	}
};
