import type { BaseArrClient } from '$arr/base.ts';
import type { DriftCounts, DriftDiff } from '$shared/drift.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import {
	buildExpectedCustomFormatsPerDatabase,
	compareCustomFormatDriftPerDatabase
} from './customFormats.ts';
import { checkDelayProfileDrift } from './delayProfiles.ts';
import { hashDriftDiff } from './hash.ts';
import { checkMediaManagementDrift } from './mediaManagement.ts';
import {
	buildExpectedQualityProfilesPerDatabase,
	compareQualityProfileDriftPerDatabase
} from './qualityProfiles.ts';

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
		| 'getQualityDefinitions'
	>,
	instanceId: number,
	arrType: SyncArrType
): Promise<DriftCheckResult> {
	const [expectedCfPerDb, actualCustomFormats, delayProfiles, mediaManagement] = await Promise.all([
		buildExpectedCustomFormatsPerDatabase(instanceId, arrType),
		client.getCustomFormats(),
		checkDelayProfileDrift(client, instanceId),
		checkMediaManagementDrift(client, instanceId, arrType)
	]);

	const customFormats = compareCustomFormatDriftPerDatabase(expectedCfPerDb, actualCustomFormats);

	const [expectedQpPerDb, actualProfiles] = await Promise.all([
		buildExpectedQualityProfilesPerDatabase(instanceId, arrType, actualCustomFormats),
		client.getQualityProfiles()
	]);

	const qualityProfiles = compareQualityProfileDriftPerDatabase(
		expectedQpPerDb,
		actualProfiles,
		actualCustomFormats,
		arrType
	);

	const counts: DriftCounts = {
		custom_formats: customFormats.count,
		quality_profiles: qualityProfiles.count,
		delay_profiles: delayProfiles.count,
		media_management: mediaManagement.count
	};
	const diff: DriftDiff = {
		custom_formats: customFormats.diffs,
		quality_profiles: qualityProfiles.diffs,
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
