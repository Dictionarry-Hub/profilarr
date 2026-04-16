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

	const installed = await getCommits(database.local_path, limit, 'HEAD', 'installed');

	const available =
		status.behind > 0 && branch
			? await getCommits(database.local_path, limit, `HEAD..origin/${branch}`, 'available')
			: [];

	const commits = [...available, ...installed].sort(
		(a, b) => Date.parse(b.date) - Date.parse(a.date)
	);

	return json({
		commits,
		branch,
		repositoryUrl: database.repository_url
	});
};
