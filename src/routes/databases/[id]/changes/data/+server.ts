import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { databaseAnnouncementQueries } from '$db/queries/databaseAnnouncements.ts';
import { getBranches, getIncomingChanges, getRepoInfo, getStatus } from '$utils/git/index.ts';
import { listDraftEntityChanges, type DraftEntityChange } from '$pcd/ops/draftChanges.ts';
import { parseAnnouncementFile } from '$announcements/database/index.ts';

const FILE_CHANGE_EXCLUDED_PREFIXES = ['deps/', 'ops/'];
const ANNOUNCEMENT_PATH_RE = /^announcements\/([^/]+)\.md$/;

type WorkingTreeOp = 'create' | 'update' | 'delete';

const FILE_SUMMARY: Record<WorkingTreeOp, string> = {
	create: 'New file',
	update: 'Modified on disk',
	delete: 'Deleted on disk'
};

const ANNOUNCEMENT_SUMMARY: Record<WorkingTreeOp, string> = {
	create: 'New announcement',
	update: 'Edited announcement',
	delete: 'Withdrawn announcement'
};

async function buildFileChange(
	filepath: string,
	op: WorkingTreeOp,
	databaseId: number,
	pcdPath: string,
	now: string
): Promise<DraftEntityChange> {
	const base = {
		key: `file:${filepath}`,
		path: filepath,
		operation: op,
		changedFields: [],
		updatedAt: now,
		ops: [],
		sections: []
	} satisfies Partial<DraftEntityChange> & { key: string };

	const announcementMatch = filepath.match(ANNOUNCEMENT_PATH_RE);
	if (!announcementMatch) {
		return {
			...base,
			entity: 'file',
			name: filepath,
			summary: FILE_SUMMARY[op]
		};
	}

	const ulid = announcementMatch[1];

	if (op === 'delete') {
		// File is gone — name comes from the cached row left behind by the
		// withdraw flow's reconcileFromWorkingCopy (withdrawn=1, title kept).
		const cached = databaseAnnouncementQueries.getById(ulid, databaseId);
		return {
			...base,
			entity: 'announcement',
			name: cached?.title ?? ulid,
			summary: ANNOUNCEMENT_SUMMARY.delete
		};
	}

	const parsed = await parseAnnouncementFile(pcdPath, ulid);
	if (parsed && !('reason' in parsed)) {
		return {
			...base,
			entity: 'announcement',
			name: parsed.title,
			summary: ANNOUNCEMENT_SUMMARY[op]
		};
	}

	// Malformed file or read error — surface the ULID and flag in the summary.
	return {
		...base,
		entity: 'announcement',
		name: ulid,
		summary: `${ANNOUNCEMENT_SUMMARY[op]} (malformed)`
	};
}

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

		const now = new Date().toISOString();
		const buckets: Array<[string[], WorkingTreeOp]> = [
			[status.untracked, 'create'],
			[status.modified, 'update'],
			[status.deleted, 'delete']
		];

		for (const [paths, op] of buckets) {
			for (const filepath of paths) {
				if (FILE_CHANGE_EXCLUDED_PREFIXES.some((prefix) => filepath.startsWith(prefix))) continue;
				draftChanges.push(await buildFileChange(filepath, op, id, database.local_path, now));
			}
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
