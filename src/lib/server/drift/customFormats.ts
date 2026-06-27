import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { getCache } from '$pcd/index.ts';
import { getCustomFormatsForProfile } from '$pcd/references.ts';
import type { BaseArrClient } from '$arr/base.ts';
import type { SyncArrType } from '$sync/mappings.ts';
import {
	fetchCustomFormatFromPcd,
	transformCustomFormat,
	type ArrCustomFormat,
	type ArrCustomFormatSpecification
} from '$sync/customFormats/transformer.ts';
import { stringifyCanonical } from './hash.ts';

export interface DriftFieldDiff {
	path: string;
	expected: unknown;
	actual: unknown;
}

export interface CustomFormatMissingDiff {
	name: string;
}

export interface CustomFormatModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

export interface CustomFormatDriftDiff {
	missing: CustomFormatMissingDiff[];
	modified: CustomFormatModifiedDiff[];
}

export interface CustomFormatDriftResult {
	count: number;
	diff: CustomFormatDriftDiff;
}

export interface DatabaseCustomFormatDriftDiff {
	databaseId: number;
	databaseName: string;
	diff: CustomFormatDriftDiff;
}

type NormalizedField = {
	name: string;
	value: unknown;
};

type NormalizedSpecification = {
	name: string;
	implementation: string;
	negate: boolean;
	required: boolean;
	fields: NormalizedField[];
};

type NormalizedCustomFormat = {
	name: string;
	includeCustomFormatWhenRenaming: boolean;
	specifications: NormalizedSpecification[];
};

function compareByString(a: string, b: string): number {
	return a.localeCompare(b);
}

function fieldKey(field: NormalizedField): string {
	return field.name;
}

function specificationKey(specification: Pick<NormalizedSpecification, 'implementation' | 'name'>) {
	return `${specification.implementation}:${specification.name}`;
}

function normalizeSpecification(
	specification: ArrCustomFormatSpecification
): NormalizedSpecification {
	return {
		name: specification.name,
		implementation: specification.implementation,
		negate: Boolean(specification.negate),
		required: Boolean(specification.required),
		fields: [...(specification.fields ?? [])]
			.map((field) => ({
				name: field.name,
				value: field.value
			}))
			.sort((a, b) => compareByString(fieldKey(a), fieldKey(b)))
	};
}

function normalizeCustomFormat(format: ArrCustomFormat): NormalizedCustomFormat {
	return {
		name: format.name,
		includeCustomFormatWhenRenaming: Boolean(format.includeCustomFormatWhenRenaming),
		specifications: [...(format.specifications ?? [])]
			.map(normalizeSpecification)
			.sort((a, b) => compareByString(specificationKey(a), specificationKey(b)))
	};
}

function valuesEqual(expected: unknown, actual: unknown): boolean {
	if (
		(expected === null || expected === undefined || expected === false) &&
		(actual === null || actual === undefined || actual === false)
	) {
		return true;
	}
	return stringifyCanonical(expected) === stringifyCanonical(actual);
}

function isAbsentDefault(value: unknown): boolean {
	return value === null || value === undefined || value === false;
}

function compareFields(
	expected: NormalizedSpecification,
	actual: NormalizedSpecification
): DriftFieldDiff[] {
	const diffs: DriftFieldDiff[] = [];
	const actualFields = new Map(actual.fields.map((field) => [fieldKey(field), field]));
	const expectedFields = new Map(expected.fields.map((field) => [fieldKey(field), field]));
	const specPath = `specifications[${specificationKey(expected)}]`;

	for (const expectedField of expected.fields) {
		const actualField = actualFields.get(fieldKey(expectedField));
		const path = `${specPath}.fields[${fieldKey(expectedField)}]`;
		if (!actualField) {
			if (isAbsentDefault(expectedField.value)) continue;
			diffs.push({ path, expected: expectedField.value, actual: null });
			continue;
		}
		if (!valuesEqual(expectedField.value, actualField.value)) {
			diffs.push({ path, expected: expectedField.value, actual: actualField.value });
		}
	}

	for (const actualField of actual.fields) {
		if (expectedFields.has(fieldKey(actualField))) continue;
		if (isAbsentDefault(actualField.value)) continue;
		diffs.push({
			path: `${specPath}.fields[${fieldKey(actualField)}]`,
			expected: null,
			actual: actualField.value
		});
	}

	return diffs;
}

function compareSpecifications(
	expected: NormalizedCustomFormat,
	actual: NormalizedCustomFormat
): DriftFieldDiff[] {
	const diffs: DriftFieldDiff[] = [];
	const actualSpecs = new Map(actual.specifications.map((spec) => [specificationKey(spec), spec]));
	const expectedSpecs = new Map(
		expected.specifications.map((spec) => [specificationKey(spec), spec])
	);

	for (const expectedSpec of expected.specifications) {
		const actualSpec = actualSpecs.get(specificationKey(expectedSpec));
		const specPath = `specifications[${specificationKey(expectedSpec)}]`;
		if (!actualSpec) {
			diffs.push({ path: specPath, expected: expectedSpec, actual: null });
			continue;
		}
		if (expectedSpec.negate !== actualSpec.negate) {
			diffs.push({
				path: `${specPath}.negate`,
				expected: expectedSpec.negate,
				actual: actualSpec.negate
			});
		}
		if (expectedSpec.required !== actualSpec.required) {
			diffs.push({
				path: `${specPath}.required`,
				expected: expectedSpec.required,
				actual: actualSpec.required
			});
		}
		diffs.push(...compareFields(expectedSpec, actualSpec));
	}

	for (const actualSpec of actual.specifications) {
		if (expectedSpecs.has(specificationKey(actualSpec))) continue;
		diffs.push({
			path: `specifications[${specificationKey(actualSpec)}]`,
			expected: null,
			actual: actualSpec
		});
	}

	return diffs;
}

function compareCustomFormat(
	expected: NormalizedCustomFormat,
	actual: NormalizedCustomFormat
): DriftFieldDiff[] {
	const diffs: DriftFieldDiff[] = [];

	if (expected.includeCustomFormatWhenRenaming !== actual.includeCustomFormatWhenRenaming) {
		diffs.push({
			path: 'includeCustomFormatWhenRenaming',
			expected: expected.includeCustomFormatWhenRenaming,
			actual: actual.includeCustomFormatWhenRenaming
		});
	}

	diffs.push(...compareSpecifications(expected, actual));
	return diffs;
}

export function compareCustomFormatDrift(
	expectedFormats: ArrCustomFormat[],
	actualFormats: ArrCustomFormat[]
): CustomFormatDriftResult {
	const actualByName = new Map(
		actualFormats.map((format) => [format.name, normalizeCustomFormat(format)])
	);
	const diff: CustomFormatDriftDiff = { missing: [], modified: [] };

	for (const expectedRaw of [...expectedFormats].sort((a, b) => compareByString(a.name, b.name))) {
		const expected = normalizeCustomFormat(expectedRaw);
		const actual = actualByName.get(expected.name);
		if (!actual) {
			diff.missing.push({ name: expected.name });
			continue;
		}

		const fields = compareCustomFormat(expected, actual);
		if (fields.length > 0) {
			diff.modified.push({ name: expected.name, fields });
		}
	}

	return {
		count: diff.missing.length + diff.modified.length,
		diff
	};
}

export async function buildExpectedCustomFormats(
	instanceId: number,
	arrType: SyncArrType
): Promise<ArrCustomFormat[]> {
	const syncConfig = arrSyncQueries.getQualityProfilesSync(instanceId);
	if (syncConfig.selections.length === 0) return [];

	const expected = new Map<string, ArrCustomFormat>();

	for (const selection of syncConfig.selections) {
		const cache = getCache(selection.databaseId);
		if (!cache) {
			throw new Error(`PCD cache not found for database ${selection.databaseId}`);
		}

		const formatNames = await getCustomFormatsForProfile(cache, selection.profileName, arrType);
		for (const formatName of formatNames) {
			if (expected.has(formatName)) continue;

			const pcdFormat = await fetchCustomFormatFromPcd(cache, formatName);
			if (!pcdFormat) {
				throw new Error(
					`Custom format "${formatName}" not found in database ${selection.databaseId}`
				);
			}

			const arrFormat = transformCustomFormat(pcdFormat, arrType);
			arrFormat.name = formatName;
			expected.set(formatName, arrFormat);
		}
	}

	return [...expected.values()];
}

export interface PerDatabaseExpectedFormats {
	databaseName: string;
	formats: ArrCustomFormat[];
}

export async function buildExpectedCustomFormatsPerDatabase(
	instanceId: number,
	arrType: SyncArrType
): Promise<Map<number, PerDatabaseExpectedFormats>> {
	const syncConfig = arrSyncQueries.getQualityProfilesSync(instanceId);
	const result = new Map<number, PerDatabaseExpectedFormats>();
	if (syncConfig.selections.length === 0) return result;

	const selectionsByDb = new Map<number, typeof syncConfig.selections>();
	for (const selection of syncConfig.selections) {
		const existing = selectionsByDb.get(selection.databaseId) ?? [];
		existing.push(selection);
		selectionsByDb.set(selection.databaseId, existing);
	}

	for (const [databaseId, selections] of selectionsByDb) {
		const cache = getCache(databaseId);
		if (!cache) {
			throw new Error(`PCD cache not found for database ${databaseId}`);
		}

		const dbInstance = databaseInstancesQueries.getById(databaseId);
		const databaseName = dbInstance?.name ?? `Database ${databaseId}`;
		const expected = new Map<string, ArrCustomFormat>();

		for (const selection of selections) {
			const formatNames = await getCustomFormatsForProfile(cache, selection.profileName, arrType);
			for (const formatName of formatNames) {
				if (expected.has(formatName)) continue;

				const pcdFormat = await fetchCustomFormatFromPcd(cache, formatName);
				if (!pcdFormat) {
					throw new Error(`Custom format "${formatName}" not found in database ${databaseId}`);
				}

				const arrFormat = transformCustomFormat(pcdFormat, arrType);
				arrFormat.name = formatName;
				expected.set(formatName, arrFormat);
			}
		}

		if (expected.size > 0) {
			result.set(databaseId, { databaseName, formats: [...expected.values()] });
		}
	}

	return result;
}

export function compareCustomFormatDriftPerDatabase(
	perDb: Map<number, PerDatabaseExpectedFormats>,
	actualFormats: ArrCustomFormat[]
): { count: number; diffs: DatabaseCustomFormatDriftDiff[] } {
	const diffs: DatabaseCustomFormatDriftDiff[] = [];
	let count = 0;

	for (const [databaseId, { databaseName, formats }] of perDb) {
		const result = compareCustomFormatDrift(formats, actualFormats);
		count += result.count;
		diffs.push({ databaseId, databaseName, diff: result.diff });
	}

	return { count, diffs };
}

export async function checkCustomFormatDrift(
	client: Pick<BaseArrClient, 'getCustomFormats'>,
	instanceId: number,
	arrType: SyncArrType
): Promise<CustomFormatDriftResult> {
	const [expectedFormats, actualFormats] = await Promise.all([
		buildExpectedCustomFormats(instanceId, arrType),
		client.getCustomFormats()
	]);

	return compareCustomFormatDrift(expectedFormats, actualFormats);
}
