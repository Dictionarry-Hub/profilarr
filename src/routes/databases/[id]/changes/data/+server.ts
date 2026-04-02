import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { getBranches, getIncomingChanges, getRepoInfo, getStatus } from '$utils/git/index.ts';
import { listDraftEntityChanges } from '$pcd/ops/draftChanges.ts';

export const GET: RequestHandler = async ({ params }) => {
	const id = parseInt(params.id || '', 10);
	const database = databaseInstancesQueries.getById(id);

	if (!database) {
		error(404, 'Database not found');
	}

	// Fetch data for everyone
	const [status, incomingChanges, branches, repoInfo] = await Promise.all([
		getStatus(database.local_path),
		getIncomingChanges(database.local_path),
		getBranches(database.local_path),
		getRepoInfo(database.repository_url, database.personal_access_token)
	]);

	// Only fetch draft changes for developers
	let draftChanges = null;
	if (database.personal_access_token) {
		draftChanges = listDraftEntityChanges(id);

		// Append working-tree file changes (modified + untracked, excluding deps/ and ops/)
		const FILE_CHANGE_EXCLUDED_PREFIXES = ['deps/', 'ops/'];
		for (const filepath of status.modified) {
			if (FILE_CHANGE_EXCLUDED_PREFIXES.some((prefix) => filepath.startsWith(prefix))) continue;
			draftChanges.push({
				key: `file:${filepath}`,
				entity: 'file',
				name: filepath,
				operation: 'update',
				summary: 'Modified on disk',
				changedFields: [],
				updatedAt: new Date().toISOString(),
				ops: [],
				sections: []
			});
		}
		for (const filepath of status.untracked) {
			if (FILE_CHANGE_EXCLUDED_PREFIXES.some((prefix) => filepath.startsWith(prefix))) continue;
			draftChanges.push({
				key: `file:${filepath}`,
				entity: 'file',
				name: filepath,
				operation: 'create',
				summary: 'New file',
				changedFields: [],
				updatedAt: new Date().toISOString(),
				ops: [],
				sections: []
			});
		}
	}

	return json({
		status,
		incomingChanges,
		branches,
		repoInfo,
		draftChanges
	});
};
