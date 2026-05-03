import type { BaseArrClient } from '$arr/base.ts';
import type { DriftCounts, DriftDiff } from '$shared/drift.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import { checkCustomFormatDrift } from './customFormats.ts';
import { hashDriftDiff } from './hash.ts';

export interface DriftCheckResult {
	status: 'clean' | 'drift_detected';
	counts: DriftCounts;
	diff: DriftDiff;
	diffHash: string;
}

export async function checkArrDrift(
	client: Pick<BaseArrClient, 'getCustomFormats'>,
	instanceId: number,
	arrType: SyncArrType
): Promise<DriftCheckResult> {
	const customFormats = await checkCustomFormatDrift(client, instanceId, arrType);
	const counts: DriftCounts = {
		custom_formats: customFormats.count
	};
	const diff: DriftDiff = {
		custom_formats: customFormats.diff
	};
	const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);

	return {
		status: total === 0 ? 'clean' : 'drift_detected',
		counts,
		diff,
		diffHash: await hashDriftDiff(diff)
	};
}
