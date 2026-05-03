import { arrSyncQueries } from '$db/queries/arrSync.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type {
	ArrCustomFormat,
	ArrLanguage,
	ArrQualityProfile,
	ArrQualityProfilePayload,
	QualityProfileFormatItem
} from '$arr/types.ts';
import { getCache } from '$pcd/index.ts';
import { getCustomFormatsForProfile } from '$pcd/references.ts';
import {
	fetchQualityProfileFromPcd,
	getQualityApiMappings,
	transformQualityProfile
} from '$sync/qualityProfiles/transformer.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import type { DriftFieldDiff } from './customFormats.ts';
import { stringifyCanonical } from './hash.ts';

export interface QualityProfileMissingDiff {
	name: string;
}

export interface QualityProfileModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

export interface QualityProfileDriftDiff {
	missing: QualityProfileMissingDiff[];
	modified: QualityProfileModifiedDiff[];
}

export interface QualityProfileDriftResult {
	count: number;
	diff: QualityProfileDriftDiff;
}

export interface QualityProfileDriftExpected {
	profile: ArrQualityProfilePayload;
	managedCustomFormatNames: string[];
	managedCustomFormatScores?: { name: string; score: number }[];
}

interface ActualQualityProfile extends ArrQualityProfile {
	language?: ArrLanguage;
	minUpgradeFormatScore?: number;
}

interface QualityProfileItemLike {
	quality?: { id: number; name: string; source?: string; resolution?: number };
	items?: QualityProfileItemLike[] | unknown[];
	allowed?: boolean;
	id?: number;
	name?: string;
}

interface NormalizedQualityItem {
	type: 'quality' | 'group';
	id: number;
	name: string;
	allowed: boolean;
	upgradeUntil?: boolean;
	items?: NormalizedQualityItem[];
}

function compareByString(a: string, b: string): number {
	return a.localeCompare(b);
}

function valuesEqual(expected: unknown, actual: unknown): boolean {
	return stringifyCanonical(expected) === stringifyCanonical(actual);
}

function profileName(profile: QualityProfileDriftExpected): string {
	return profile.profile.name;
}

function formatItemById(
	formatItems: QualityProfileFormatItem[] | undefined
): Map<number, QualityProfileFormatItem> {
	return new Map((formatItems ?? []).map((item) => [item.format, item]));
}

function customFormatsByName(formats: ArrCustomFormat[]): Map<string, ArrCustomFormat> {
	return new Map(formats.map((format) => [format.name, format]));
}

function customFormatsById(formats: ArrCustomFormat[]): Map<number, ArrCustomFormat> {
	const map = new Map<number, ArrCustomFormat>();
	for (const format of formats) {
		if (format.id !== undefined) map.set(format.id, format);
	}
	return map;
}

function normalizeQualityItem(
	item: QualityProfileItemLike,
	cutoff: number | undefined
): NormalizedQualityItem {
	if (item.quality) {
		return {
			type: 'quality',
			id: item.quality.id,
			name: item.quality.name,
			allowed: Boolean(item.allowed),
			upgradeUntil: item.quality.id === cutoff
		};
	}

	return {
		type: 'group',
		id: item.id ?? 0,
		name: item.name ?? '',
		allowed: Boolean(item.allowed),
		upgradeUntil: (item.id ?? 0) === cutoff,
		items: (item.items ?? []).map((child) =>
			normalizeQualityItem(child as QualityProfileItemLike, cutoff)
		)
	};
}

function normalizedItems(profile: {
	items?: QualityProfileItemLike[];
	cutoff?: number;
}): NormalizedQualityItem[] {
	return (profile.items ?? []).map((item) => normalizeQualityItem(item, profile.cutoff));
}

function languageDiff(
	expected: ArrQualityProfilePayload,
	actual: ActualQualityProfile,
	arrType: SyncArrType
): DriftFieldDiff | null {
	if (arrType !== 'radarr') return null;

	const expectedLanguage = expected.language ?? null;
	const actualLanguage = actual.language ?? null;
	if (valuesEqual(expectedLanguage, actualLanguage)) return null;

	return {
		path: 'language',
		expected: expectedLanguage,
		actual: actualLanguage
	};
}

function settingDiffs(
	expected: ArrQualityProfilePayload,
	actual: ActualQualityProfile,
	arrType: SyncArrType
): DriftFieldDiff[] {
	const diffs: DriftFieldDiff[] = [];
	const fields = [
		'cutoffFormatScore',
		'minFormatScore',
		'minUpgradeFormatScore',
		'upgradeAllowed'
	] as const;

	for (const field of fields) {
		if (expected[field] !== actual[field]) {
			diffs.push({ path: field, expected: expected[field], actual: actual[field] });
		}
	}

	const language = languageDiff(expected, actual, arrType);
	if (language) diffs.push(language);

	return diffs;
}

function qualityItemsDiff(
	expected: ArrQualityProfilePayload,
	actual: ActualQualityProfile
): DriftFieldDiff | null {
	const expectedItems = normalizedItems(expected);
	const actualItems = normalizedItems({ items: actual.items ?? [], cutoff: actual.cutoff });
	if (valuesEqual(expectedItems, actualItems)) return null;

	return {
		path: 'items',
		expected: expectedItems,
		actual: actualItems
	};
}

function expectedFormatScore(expected: QualityProfileDriftExpected, formatName: string): number {
	const managedScore = expected.managedCustomFormatScores?.find((item) => item.name === formatName);
	if (managedScore) return managedScore.score;
	return expected.profile.formatItems.find((item) => item.name === formatName)?.score ?? 0;
}

function formatItemDiffs(
	expected: QualityProfileDriftExpected,
	actual: ActualQualityProfile,
	actualCustomFormats: ArrCustomFormat[]
): DriftFieldDiff[] {
	const diffs: DriftFieldDiff[] = [];
	const formatsByName = customFormatsByName(actualCustomFormats);
	const formatsById = customFormatsById(actualCustomFormats);
	const actualItemsById = formatItemById(actual.formatItems);
	const managedNames = new Set(expected.managedCustomFormatNames);

	for (const formatName of [...managedNames].sort(compareByString)) {
		const expectedScore = expectedFormatScore(expected, formatName);
		const arrFormat = formatsByName.get(formatName);
		const path = `formatItems[${formatName}]`;
		const expectedValue = { name: formatName, score: expectedScore };

		if (!arrFormat || arrFormat.id === undefined) {
			diffs.push({
				path,
				expected: expectedValue,
				actual: { name: formatName, state: 'missing_custom_format' }
			});
			continue;
		}

		const actualItem = actualItemsById.get(arrFormat.id);
		if (!actualItem) {
			diffs.push({ path, expected: expectedValue, actual: null });
			continue;
		}

		if (actualItem.score !== expectedScore) {
			diffs.push({
				path,
				expected: expectedValue,
				actual: { name: formatName, score: actualItem.score }
			});
		}
	}

	const sortedActualItems = [...(actual.formatItems ?? [])].sort((a, b) =>
		compareByString(a.name, b.name)
	);
	for (const actualItem of sortedActualItems) {
		const arrFormat = formatsById.get(actualItem.format);
		const name = arrFormat?.name ?? actualItem.name;
		if (!name || managedNames.has(name) || actualItem.score === 0) continue;

		diffs.push({
			path: `formatItems[${name}]`,
			expected: { name, score: 0, state: 'unmanaged' },
			actual: { name, score: actualItem.score }
		});
	}

	return diffs;
}

function compareProfile(
	expected: QualityProfileDriftExpected,
	actual: ActualQualityProfile,
	actualCustomFormats: ArrCustomFormat[],
	arrType: SyncArrType
): DriftFieldDiff[] {
	const items = qualityItemsDiff(expected.profile, actual);
	const diffs = [
		...settingDiffs(expected.profile, actual, arrType),
		...(items ? [items] : []),
		...formatItemDiffs(expected, actual, actualCustomFormats)
	];

	return diffs.sort((a, b) => compareByString(a.path, b.path));
}

export function compareQualityProfileDrift(
	expectedProfiles: QualityProfileDriftExpected[],
	actualProfiles: ArrQualityProfile[],
	actualCustomFormats: ArrCustomFormat[],
	arrType: SyncArrType
): QualityProfileDriftResult {
	const actualByName = new Map(
		actualProfiles.map((profile) => [profile.name, profile as ActualQualityProfile])
	);
	const diff: QualityProfileDriftDiff = { missing: [], modified: [] };

	for (const expected of [...expectedProfiles].sort((a, b) =>
		compareByString(profileName(a), profileName(b))
	)) {
		const actual = actualByName.get(expected.profile.name);
		if (!actual) {
			diff.missing.push({ name: expected.profile.name });
			continue;
		}

		const fields = compareProfile(expected, actual, actualCustomFormats, arrType);
		if (fields.length > 0) {
			diff.modified.push({ name: expected.profile.name, fields });
		}
	}

	return {
		count: diff.missing.length + diff.modified.length,
		diff
	};
}

export async function buildExpectedQualityProfiles(
	instanceId: number,
	arrType: SyncArrType,
	actualCustomFormats: ArrCustomFormat[]
): Promise<QualityProfileDriftExpected[]> {
	const syncConfig = arrSyncQueries.getQualityProfilesSync(instanceId);
	if (syncConfig.selections.length === 0) return [];

	const expected: QualityProfileDriftExpected[] = [];
	const formatIdMap = new Map<string, number>();
	for (const format of actualCustomFormats) {
		if (format.id !== undefined) formatIdMap.set(format.name, format.id);
	}

	for (const selection of syncConfig.selections) {
		const cache = getCache(selection.databaseId);
		if (!cache) {
			throw new Error(`PCD cache not found for database ${selection.databaseId}`);
		}

		const pcdProfile = await fetchQualityProfileFromPcd(cache, selection.profileName, arrType);
		if (!pcdProfile) {
			throw new Error(
				`Quality profile "${selection.profileName}" not found in database ${selection.databaseId}`
			);
		}

		const [qualityMappings, managedCustomFormatNames] = await Promise.all([
			getQualityApiMappings(cache, arrType),
			getCustomFormatsForProfile(cache, selection.profileName, arrType)
		]);

		const profile = transformQualityProfile(pcdProfile, arrType, qualityMappings, formatIdMap);
		profile.name = pcdProfile.name;
		expected.push({
			profile,
			managedCustomFormatNames,
			managedCustomFormatScores: pcdProfile.customFormats.map((format) => ({
				name: format.formatName,
				score: format.score
			}))
		});
	}

	return expected;
}

export async function checkQualityProfileDrift(
	client: Pick<BaseArrClient, 'getQualityProfiles'>,
	instanceId: number,
	arrType: SyncArrType,
	actualCustomFormats: ArrCustomFormat[]
): Promise<QualityProfileDriftResult> {
	const [expectedProfiles, actualProfiles] = await Promise.all([
		buildExpectedQualityProfiles(instanceId, arrType, actualCustomFormats),
		client.getQualityProfiles()
	]);

	return compareQualityProfileDrift(expectedProfiles, actualProfiles, actualCustomFormats, arrType);
}
