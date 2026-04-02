import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { getCommits, getStatus } from '$utils/git/index.ts';

export const GET: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id || '', 10);
	const database = databaseInstancesQueries.getById(id);

	if (!database) {
		error(404, 'Database not found');
	}

	const limit = parseInt(url.searchParams.get('limit') || '50', 10);
	const status = await getStatus(database.local_path, { fetch: true });
	const branch = status.branch;
	const remoteRef = branch ? `origin/${branch}` : null;
	const shouldUseRemote = status.behind > 0 && status.ahead === 0 && remoteRef;
	let commits = [];
	try {
		commits = await getCommits(database.local_path, limit, shouldUseRemote ? remoteRef : 'HEAD');
	} catch {
		commits = await getCommits(database.local_path, limit);
	}

	return json({
		commits,
		branch,
		repositoryUrl: database.repository_url
	});
};
