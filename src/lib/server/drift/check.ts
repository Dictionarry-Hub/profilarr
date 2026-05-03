import type { BaseArrClient } from '$arr/base.ts';
import type { DriftCounts, DriftDiff } from '$shared/drift.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import { compareCustomFormatDrift, buildExpectedCustomFormats } from './customFormats.ts';
import { hashDriftDiff } from './hash.ts';
import { checkQualityProfileDrift } from './qualityProfiles.ts';

export interface DriftCheckResult {
	status: 'clean' | 'drift_detected';
	counts: DriftCounts;
	diff: DriftDiff;
	diffHash: string;
}

export async function checkArrDrift(
	client: Pick<BaseArrClient, 'getCustomFormats' | 'getQualityProfiles'>,
	instanceId: number,
	arrType: SyncArrType
): Promise<DriftCheckResult> {
	const [expectedCustomFormats, actualCustomFormats] = await Promise.all([
		buildExpectedCustomFormats(instanceId, arrType),
		client.getCustomFormats()
	]);
	const customFormats = compareCustomFormatDrift(expectedCustomFormats, actualCustomFormats);
	const qualityProfiles = await checkQualityProfileDrift(
		client,
		instanceId,
		arrType,
		actualCustomFormats
	);
	const counts: DriftCounts = {
		custom_formats: customFormats.count,
		quality_profiles: qualityProfiles.count
	};
	const diff: DriftDiff = {
		custom_formats: customFormats.diff,
		quality_profiles: qualityProfiles.diff
	};
	const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);

	return {
		status: total === 0 ? 'clean' : 'drift_detected',
		counts,
		diff,
		diffHash: await hashDriftDiff(diff)
	};
}
