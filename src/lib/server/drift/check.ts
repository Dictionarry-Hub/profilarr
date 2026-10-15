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
import { createProfileSizeSource } from '$sync/qualityProfiles/sizeSource.ts';

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
		| 'getQualityProfileSchema'
	>,
	instanceId: number,
	arrType: SyncArrType,
	options: {
		/** The Arr keeps size limits on each quality profile (Sonarr v5); see hasProfileItemSizes */
		profileItemSizes?: boolean;
	} = {}
): Promise<DriftCheckResult> {
	const [expectedCfPerDb, actualCustomFormats, actualProfiles, delayProfiles, mediaManagement] =
		await Promise.all([
			buildExpectedCustomFormatsPerDatabase(instanceId, arrType),
			client.getCustomFormats(),
			client.getQualityProfiles(),
			checkDelayProfileDrift(client, instanceId),
			checkMediaManagementDrift(client, instanceId, arrType, options)
		]);

	const customFormats = compareCustomFormatDriftPerDatabase(expectedCfPerDb, actualCustomFormats);

	// Where sizes live on profiles, expected profiles carry the sizes the sync
	// would write, resolved against what the Arr has now
	const sizes = options.profileItemSizes
		? {
				source: createProfileSizeSource(client, instanceId, arrType, 'Drift:QualityProfiles'),
				actualProfiles
			}
		: undefined;
	const expectedQpPerDb = await buildExpectedQualityProfilesPerDatabase(
		instanceId,
		arrType,
		actualCustomFormats,
		sizes
	);

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
