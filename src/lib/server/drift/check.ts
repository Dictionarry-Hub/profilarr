import type { BaseArrClient } from '$arr/base.ts';
import type { DriftCounts, DriftDiff } from '$shared/drift.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import { compareCustomFormatDrift, buildExpectedCustomFormats } from './customFormats.ts';
import { checkDelayProfileDrift } from './delayProfiles.ts';
import { hashDriftDiff } from './hash.ts';
import { checkMediaManagementDrift } from './mediaManagement.ts';
import { checkQualityProfileDrift } from './qualityProfiles.ts';

export interface DriftCheckResult {
	status: 'clean' | 'drift_detected';
	counts: DriftCounts;
	diff: DriftDiff;
	diffHash: string;
}

export async function checkArrDrift(
	client: Pick<
		BaseArrClient,
		| 'getCustomFormats'
		| 'getQualityProfiles'
		| 'getDelayProfiles'
		| 'getMediaManagementConfig'
		| 'getNamingConfig'
	>,
	instanceId: number,
	arrType: SyncArrType
): Promise<DriftCheckResult> {
	const [expectedCustomFormats, actualCustomFormats, delayProfiles, mediaManagement] =
		await Promise.all([
			buildExpectedCustomFormats(instanceId, arrType),
			client.getCustomFormats(),
			checkDelayProfileDrift(client, instanceId),
			checkMediaManagementDrift(client, instanceId, arrType)
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
		quality_profiles: qualityProfiles.count,
		delay_profiles: delayProfiles.count,
		media_management: mediaManagement.count
	};
	const diff: DriftDiff = {
		custom_formats: customFormats.diff,
		quality_profiles: qualityProfiles.diff,
		delay_profiles: delayProfiles.diff,
		media_management: mediaManagement.diff
	};
	const total = Object.values(counts).reduce((sum, count) => sum + (count ?? 0), 0);

	return {
		status: total === 0 ? 'clean' : 'drift_detected',
		counts,
		diff,
		diffHash: await hashDriftDiff(diff)
	};
}
