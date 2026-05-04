import { arrSyncQueries } from '$db/queries/arrSync.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type { ArrDelayProfile } from '$arr/types.ts';
import { getCache } from '$pcd/index.ts';
import { getByName as getDelayProfileByName } from '$pcd/entities/delayProfiles/index.ts';
import { transformDelayProfile } from '$sync/delayProfiles/transformer.ts';
import type { DriftFieldDiff } from './customFormats.ts';
import { stringifyCanonical } from './hash.ts';

type DelayProtocol =
	| 'prefer_usenet'
	| 'prefer_torrent'
	| 'only_usenet'
	| 'only_torrent'
	| 'unknown';

export interface DelayProfileMissingDiff {
	name: string;
}

export interface DelayProfileModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

export interface DelayProfileDriftDiff {
	missing: DelayProfileMissingDiff[];
	modified: DelayProfileModifiedDiff[];
}

export interface DelayProfileDriftResult {
	count: number;
	diff: DelayProfileDriftDiff;
}

export interface DelayProfileDriftExpected {
	name: string;
	profile: ArrDelayProfile;
}

interface NormalizedDelayProfile {
	id: number;
	protocol: DelayProtocol;
	usenetDelay: number;
	torrentDelay: number;
	bypassIfHighestQuality: boolean;
	bypassIfAboveCustomFormatScore: boolean;
	minimumCustomFormatScore: number;
	order: number;
	tags: number[];
}

const FIELD_ORDER = [
	'id',
	'protocol',
	'usenetDelay',
	'torrentDelay',
	'bypassIfHighestQuality',
	'bypassIfAboveCustomFormatScore',
	'minimumCustomFormatScore',
	'order',
	'tags'
] as const;

function valuesEqual(expected: unknown, actual: unknown): boolean {
	return stringifyCanonical(expected) === stringifyCanonical(actual);
}

function protocol(profile: ArrDelayProfile): DelayProtocol {
	if (profile.enableUsenet && profile.enableTorrent) {
		if (profile.preferredProtocol === 'usenet') return 'prefer_usenet';
		if (profile.preferredProtocol === 'torrent') return 'prefer_torrent';
		return 'unknown';
	}

	if (profile.enableUsenet && !profile.enableTorrent) {
		return profile.preferredProtocol === 'usenet' ? 'only_usenet' : 'unknown';
	}

	if (!profile.enableUsenet && profile.enableTorrent) {
		return profile.preferredProtocol === 'torrent' ? 'only_torrent' : 'unknown';
	}

	return 'unknown';
}

function normalizeProfile(profile: ArrDelayProfile): NormalizedDelayProfile {
	return {
		id: profile.id,
		protocol: protocol(profile),
		usenetDelay: profile.usenetDelay ?? 0,
		torrentDelay: profile.torrentDelay ?? 0,
		bypassIfHighestQuality: Boolean(profile.bypassIfHighestQuality),
		bypassIfAboveCustomFormatScore: Boolean(profile.bypassIfAboveCustomFormatScore),
		minimumCustomFormatScore: profile.minimumCustomFormatScore ?? 0,
		order: profile.order,
		tags: [...(profile.tags ?? [])].sort((a, b) => a - b)
	};
}

function compareProfiles(
	expected: NormalizedDelayProfile,
	actual: NormalizedDelayProfile
): DriftFieldDiff[] {
	const diffs: DriftFieldDiff[] = [];

	for (const field of FIELD_ORDER) {
		if (!valuesEqual(expected[field], actual[field])) {
			diffs.push({
				path: field,
				expected: expected[field],
				actual: actual[field]
			});
		}
	}

	return diffs;
}

export function compareDelayProfileDrift(
	expected: DelayProfileDriftExpected | null,
	actualProfiles: ArrDelayProfile[]
): DelayProfileDriftResult {
	const diff: DelayProfileDriftDiff = { missing: [], modified: [] };
	if (!expected) {
		return { count: 0, diff };
	}

	const actual = actualProfiles.find((profile) => profile.id === 1);
	if (!actual) {
		diff.missing.push({ name: expected.name });
		return { count: 1, diff };
	}

	const fields = compareProfiles(normalizeProfile(expected.profile), normalizeProfile(actual));
	if (fields.length > 0) {
		diff.modified.push({ name: expected.name, fields });
	}

	return {
		count: diff.missing.length + diff.modified.length,
		diff
	};
}

export async function buildExpectedDelayProfile(
	instanceId: number
): Promise<DelayProfileDriftExpected | null> {
	const syncConfig = arrSyncQueries.getDelayProfilesSync(instanceId);
	if (!syncConfig.databaseId || !syncConfig.profileName) return null;

	const cache = getCache(syncConfig.databaseId);
	if (!cache) {
		throw new Error(`PCD cache not found for database ${syncConfig.databaseId}`);
	}

	const profile = await getDelayProfileByName(cache, syncConfig.profileName);
	if (!profile) {
		throw new Error(
			`Delay profile "${syncConfig.profileName}" not found in database ${syncConfig.databaseId}`
		);
	}

	return {
		name: syncConfig.profileName,
		profile: transformDelayProfile(profile)
	};
}

export async function checkDelayProfileDrift(
	client: Pick<BaseArrClient, 'getDelayProfiles'>,
	instanceId: number
): Promise<DelayProfileDriftResult> {
	const expected = await buildExpectedDelayProfile(instanceId);
	if (!expected) return compareDelayProfileDrift(null, []);

	const actualProfiles = await client.getDelayProfiles();
	return compareDelayProfileDrift(expected, actualProfiles);
}
