import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import type { JobType } from './queueTypes.ts';

export type JobNameLookups = {
	arrNameById?: Map<number, string>;
	databaseNameById?: Map<number, string>;
};

export function formatJobTypeLabel(jobType: JobType): string {
	switch (jobType) {
		case 'arr.sync':
			return 'Arr Sync';
		case 'arr.sync.qualityProfiles':
			return 'Arr Sync (Quality Profiles)';
		case 'arr.sync.delayProfiles':
			return 'Arr Sync (Delay Profiles)';
		case 'arr.sync.mediaManagement':
			return 'Arr Sync (Media Management)';
		case 'arr.rename':
			return 'Arr Rename';
		case 'arr.upgrade':
			return 'Arr Upgrade';
		case 'arr.cleanup':
			return 'Arr Cleanup';
		case 'arr.library.refresh':
			return 'Library Refresh';
		case 'pcd.sync':
			return 'PCD Sync';
		case 'backup.create':
			return 'Backup Create';
		case 'backup.cleanup':
			return 'Backup Cleanup';
		case 'logs.cleanup':
			return 'Logs Cleanup';
		default:
			return (jobType as string)
				.replace(/\./g, ' ')
				.split('_')
				.map((word: string) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(' ');
	}
}

function readId(raw: unknown): number | null {
	if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
	if (typeof raw === 'string' && raw.trim() !== '' && Number.isFinite(Number(raw))) {
		return Number(raw);
	}
	return null;
}

export function buildJobDisplayName(
	jobType: JobType,
	payload: Record<string, unknown>,
	lookups?: JobNameLookups
): string {
	const base = formatJobTypeLabel(jobType);
	const instanceId = readId(payload.instanceId);
	const databaseId = readId(payload.databaseId);

	if (jobType === 'pcd.sync' && databaseId !== null) {
		const name =
			lookups?.databaseNameById?.get(databaseId) ??
			databaseInstancesQueries.getById(databaseId)?.name;
		return name ? `${base} - ${name}` : base;
	}

	const isArrSync = jobType === 'arr.sync' || jobType.startsWith('arr.sync.');
	if (
		(isArrSync ||
			jobType === 'arr.rename' ||
			jobType === 'arr.upgrade' ||
			jobType === 'arr.cleanup' ||
			jobType === 'arr.library.refresh') &&
		instanceId !== null
	) {
		const name =
			lookups?.arrNameById?.get(instanceId) ?? arrInstancesQueries.getById(instanceId)?.name;
		return name ? `${base} - ${name}` : base;
	}

	return base;
}
