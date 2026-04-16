import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { countCommits, getCommits, getStatus } from '$utils/git/index.ts';
import type { Commit } from '$utils/git/types.ts';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

export const GET: RequestHandler = async ({ params, url }) => {
	const id = parseInt(params.id || '', 10);
	const database = databaseInstancesQueries.getById(id);

	if (!database) {
		error(404, 'Database not found');
	}

	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10) || 1);
	const rawPageSize =
		parseInt(url.searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE), 10) ||
		DEFAULT_PAGE_SIZE;
	const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, rawPageSize));

	const status = await getStatus(database.local_path, { fetch: true });
	const branch = status.branch;

	const availableRef = branch ? `HEAD..origin/${branch}` : null;
	const availableCount = availableRef ? await countCommits(database.local_path, availableRef) : 0;
	const installedCount = await countCommits(database.local_path, 'HEAD');
	const totalCount = installedCount + availableCount;

	const skip = (page - 1) * pageSize;
	const commits: Commit[] = [];

	if (skip < availableCount && availableRef) {
		const availableLimit = Math.min(pageSize, availableCount - skip);
		const availableSlice = await getCommits(
			database.local_path,
			availableLimit,
			availableRef,
			'available',
			skip
		);
		commits.push(...availableSlice);

		const remaining = pageSize - availableSlice.length;
		if (remaining > 0 && installedCount > 0) {
			const installedSlice = await getCommits(
				database.local_path,
				remaining,
				'HEAD',
				'installed',
				0
			);
			commits.push(...installedSlice);
		}
	} else if (installedCount > 0) {
		const installedSkip = skip - availableCount;
		const installedSlice = await getCommits(
			database.local_path,
			pageSize,
			'HEAD',
			'installed',
			installedSkip
		);
		commits.push(...installedSlice);
	}

	return json({
		commits,
		totalCount,
		page,
		pageSize,
		branch,
		repositoryUrl: database.repository_url
	});
};
