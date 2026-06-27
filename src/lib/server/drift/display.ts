import {
	INDEXER_FLAGS,
	LANGUAGES,
	QUALITY_MODIFIERS,
	RELEASE_TYPES,
	RESOLUTIONS,
	SOURCES,
	type SyncArrType
} from '$sync/mappings.ts';
import type {
	DriftDiff,
	DriftDisplayChange,
	DriftDisplayDuplicateDrift,
	DriftDisplayEntity,
	DriftDisplayQualityItem,
	DriftDisplayTone,
	DriftDisplayValue
} from '$shared/drift.ts';
import { arrSyncQueries } from '$db/queries/arrSync.ts';
import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { buildExpectedCustomFormatsPerDatabase } from './customFormats.ts';

interface CustomFormatDiff {
	missing?: unknown[];
	modified?: unknown[];
}

interface QualityProfileDiff {
	missing?: unknown[];
	modified?: unknown[];
}

interface DelayProfileDiff {
	missing?: unknown[];
	modified?: unknown[];
}

interface MediaManagementDiff {
	media_settings: {
		missing?: unknown[];
		modified?: unknown[];
	};
	naming: {
		missing?: unknown[];
		modified?: unknown[];
	};
	quality_definitions: {
		missing?: unknown[];
		modified?: unknown[];
	};
}

interface DriftFieldDiff {
	path: string;
	expected: unknown;
	actual: unknown;
}

interface CustomFormatModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface QualityProfileModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface DelayProfileModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface MediaSettingsModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface NamingModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface QualityDefinitionsModifiedDiff {
	name: string;
	fields: DriftFieldDiff[];
}

interface ParsedQualityDefinitionPath {
	qualityName: string;
	field: string;
}

interface SpecificationValue {
	name: string;
	implementation: string;
	negate: boolean;
	required: boolean;
	fields: { name: string; value: unknown }[];
}

interface ParsedSpecificationPath {
	implementation: string;
	name: string;
	member?: string;
	field?: string;
}

const IMPLEMENTATION_LABELS: Record<string, string> = {
	ReleaseTitleSpecification: 'Release Title',
	ReleaseGroupSpecification: 'Release Group',
	EditionSpecification: 'Edition',
	SourceSpecification: 'Source',
	ResolutionSpecification: 'Resolution',
	IndexerFlagSpecification: 'Indexer Flag',
	QualityModifierSpecification: 'Quality Modifier',
	SizeSpecification: 'Size',
	LanguageSpecification: 'Language',
	ReleaseTypeSpecification: 'Release Type',
	YearSpecification: 'Year'
};

type DuplicateDriftLookup = Map<string, DriftDisplayDuplicateDrift>;

interface DuplicateCandidate {
	databaseId: number;
	databaseName: string;
	name: string;
}

export function buildDriftDisplayEntities(
	diff: DriftDiff,
	arrType: string | undefined,
	duplicateDriftLookup: DuplicateDriftLookup = new Map()
): DriftDisplayEntity[] {
	const syncArrType = arrType === 'radarr' || arrType === 'sonarr' ? arrType : undefined;
	return [
		...buildCustomFormatEntities(diff.custom_formats, syncArrType, duplicateDriftLookup),
		...buildQualityProfileEntities(diff.quality_profiles, syncArrType, duplicateDriftLookup),
		...buildDelayProfileEntities(diff.delay_profiles),
		...buildMediaManagementEntities(diff.media_management)
	];
}

export async function buildDriftDisplayEntitiesForInstance(
	diff: DriftDiff,
	arrType: string | undefined,
	instanceId: number
): Promise<DriftDisplayEntity[]> {
	const syncArrType = arrType === 'radarr' || arrType === 'sonarr' ? arrType : undefined;
	if (!syncArrType) return buildDriftDisplayEntities(diff, arrType);

	try {
		const duplicateDriftLookup = await buildDuplicateDriftLookup(instanceId, syncArrType);
		return buildDriftDisplayEntities(diff, arrType, duplicateDriftLookup);
	} catch {
		return buildDriftDisplayEntities(diff, arrType);
	}
}

async function buildDuplicateDriftLookup(
	instanceId: number,
	arrType: SyncArrType
): Promise<DuplicateDriftLookup> {
	const lookup: DuplicateDriftLookup = new Map();
	const priorities = new Map(
		arrSyncQueries.getDatabasePriorities(instanceId).map((row) => [row.databaseId, row.priority])
	);
	const getDatabaseName = (databaseId: number) =>
		databaseInstancesQueries.getById(databaseId)?.name ?? `Database ${databaseId}`;

	const qualityProfileCandidates = arrSyncQueries
		.getQualityProfilesSync(instanceId)
		.selections.map((selection) => ({
			databaseId: selection.databaseId,
			databaseName: getDatabaseName(selection.databaseId),
			name: selection.profileName
		}));
	addDuplicateCandidates(lookup, 'quality_profiles', qualityProfileCandidates, priorities);

	try {
		const perDbFormats = await buildExpectedCustomFormatsPerDatabase(instanceId, arrType);
		const customFormatCandidates: DuplicateCandidate[] = [];
		for (const [databaseId, { databaseName, formats }] of perDbFormats) {
			for (const format of formats) {
				customFormatCandidates.push({ databaseId, databaseName, name: format.name });
			}
		}
		addDuplicateCandidates(lookup, 'custom_formats', customFormatCandidates, priorities);
	} catch {
		// Duplicate drift is display metadata only, so stored drift should still render if caches moved.
	}

	return lookup;
}

function addDuplicateCandidates(
	lookup: DuplicateDriftLookup,
	section: 'custom_formats' | 'quality_profiles',
	candidates: DuplicateCandidate[],
	priorities: Map<number, number>
): void {
	const byName = new Map<string, Map<number, DuplicateCandidate>>();
	for (const candidate of candidates) {
		const entries = byName.get(candidate.name) ?? new Map<number, DuplicateCandidate>();
		entries.set(candidate.databaseId, candidate);
		byName.set(candidate.name, entries);
	}

	for (const [name, entries] of byName) {
		const sorted = [...entries.values()].sort(
			(a, b) =>
				(priorityFor(a.databaseId, priorities) - priorityFor(b.databaseId, priorities)) ||
				a.databaseId - b.databaseId
		);
		if (sorted.length < 2) continue;

		const winner = sorted[0];
		for (const candidate of sorted.slice(1)) {
			lookup.set(duplicateLookupKey(section, candidate.databaseId, name), {
				reason: 'lower_priority_duplicate',
				key: `${section}:${name}`,
				winnerDatabaseId: winner.databaseId,
				winnerDatabaseName: winner.databaseName
			});
		}
	}
}

function priorityFor(databaseId: number, priorities: Map<number, number>): number {
	return priorities.get(databaseId) ?? Number.MAX_SAFE_INTEGER;
}

function duplicateLookupKey(
	section: 'custom_formats' | 'quality_profiles',
	databaseId: number,
	name: string
): string {
	return `${section}:${databaseId}:${name}`;
}

function buildCustomFormatEntities(
	raw: unknown,
	arrType: SyncArrType | undefined,
	duplicateDriftLookup: DuplicateDriftLookup
): DriftDisplayEntity[] {
	if (Array.isArray(raw)) {
		const entities: DriftDisplayEntity[] = [];
		for (const entry of raw) {
			if (!isRecord(entry)) continue;
			const databaseId = recordNumber(entry, 'databaseId');
			const databaseName = recordString(entry, 'databaseName');
			const diff = asCustomFormatDiff(entry.diff);
			if (!diff) continue;
			entities.push(
				...buildCustomFormatDiffEntities(
					diff,
					arrType,
					duplicateDriftLookup,
					databaseId,
					databaseName
				)
			);
		}
		return entities;
	}

	const diff = asCustomFormatDiff(raw);
	if (!diff) return [];
	return buildCustomFormatDiffEntities(diff, arrType, duplicateDriftLookup);
}

function buildCustomFormatDiffEntities(
	diff: CustomFormatDiff,
	arrType: SyncArrType | undefined,
	duplicateDriftLookup: DuplicateDriftLookup,
	databaseId?: number | null,
	databaseName?: string | null
): DriftDisplayEntity[] {
	const entities: DriftDisplayEntity[] = [];
	const idPrefix = databaseId != null ? `custom_formats:${databaseId}` : 'custom_formats';

	for (const item of diff.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `${idPrefix}:missing:${name}`,
			section: 'custom_formats',
			sectionLabel: 'Custom Format',
			title: name,
			databaseId: databaseId ?? undefined,
			databaseName: databaseName ?? undefined,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary: 'Profilarr expects this custom format, but Arr does not have it.',
			changes: [
				{
					id: `${idPrefix}:missing:${name}:format`,
					label: 'Custom format',
					detail: 'Missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			],
			duplicateDrift:
				databaseId != null
					? duplicateDriftLookup.get(duplicateLookupKey('custom_formats', databaseId, name))
					: undefined
		});
	}

	for (const item of diff.modified ?? []) {
		const modified = asModifiedCustomFormat(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map((field, index) =>
			formatCustomFormatFieldDiff(field, index, arrType)
		);

		entities.push({
			id: `${idPrefix}:modified:${modified.name}`,
			section: 'custom_formats',
			sectionLabel: 'Custom Format',
			title: modified.name,
			databaseId: databaseId ?? undefined,
			databaseName: databaseName ?? undefined,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes,
			duplicateDrift:
				databaseId != null
					? duplicateDriftLookup.get(
							duplicateLookupKey('custom_formats', databaseId, modified.name)
						)
					: undefined
		});
	}

	return entities;
}

function buildQualityProfileEntities(
	raw: unknown,
	arrType: SyncArrType | undefined,
	duplicateDriftLookup: DuplicateDriftLookup
): DriftDisplayEntity[] {
	if (Array.isArray(raw)) {
		const entities: DriftDisplayEntity[] = [];
		for (const entry of raw) {
			if (!isRecord(entry)) continue;
			const databaseId = recordNumber(entry, 'databaseId');
			const databaseName = recordString(entry, 'databaseName');
			const diff = asQualityProfileDiff(entry.diff);
			if (!diff) continue;
			entities.push(
				...buildQualityProfileDiffEntities(
					diff,
					arrType,
					duplicateDriftLookup,
					databaseId,
					databaseName
				)
			);
		}
		return entities;
	}

	const diff = asQualityProfileDiff(raw);
	if (!diff) return [];
	return buildQualityProfileDiffEntities(diff, arrType, duplicateDriftLookup);
}

function buildQualityProfileDiffEntities(
	diff: QualityProfileDiff,
	arrType: SyncArrType | undefined,
	duplicateDriftLookup: DuplicateDriftLookup,
	databaseId?: number | null,
	databaseName?: string | null
): DriftDisplayEntity[] {
	const entities: DriftDisplayEntity[] = [];
	const idPrefix = databaseId != null ? `quality_profiles:${databaseId}` : 'quality_profiles';

	for (const item of diff.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `${idPrefix}:missing:${name}`,
			section: 'quality_profiles',
			sectionLabel: 'Quality Profile',
			title: name,
			databaseId: databaseId ?? undefined,
			databaseName: databaseName ?? undefined,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary: 'Profilarr expects this quality profile, but Arr does not have it.',
			changes: [
				{
					id: `${idPrefix}:missing:${name}:profile`,
					label: 'Quality profile',
					detail: 'Missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			],
			duplicateDrift:
				databaseId != null
					? duplicateDriftLookup.get(duplicateLookupKey('quality_profiles', databaseId, name))
					: undefined
		});
	}

	for (const item of diff.modified ?? []) {
		const modified = asModifiedQualityProfile(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map((field, index) =>
			formatQualityProfileFieldDiff(field, index, arrType)
		);

		entities.push({
			id: `${idPrefix}:modified:${modified.name}`,
			section: 'quality_profiles',
			sectionLabel: 'Quality Profile',
			title: modified.name,
			databaseId: databaseId ?? undefined,
			databaseName: databaseName ?? undefined,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes,
			duplicateDrift:
				databaseId != null
					? duplicateDriftLookup.get(
							duplicateLookupKey('quality_profiles', databaseId, modified.name)
						)
					: undefined
		});
	}

	return entities;
}

function buildDelayProfileEntities(raw: unknown): DriftDisplayEntity[] {
	const diff = asDelayProfileDiff(raw);
	if (!diff) return [];

	const entities: DriftDisplayEntity[] = [];

	for (const item of diff.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `delay_profiles:missing:${name}`,
			section: 'delay_profiles',
			sectionLabel: 'Delay Profile',
			title: name,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary:
				'Profilarr expects this delay profile on Arr default profile, but Arr does not have it.',
			changes: [
				{
					id: `delay_profiles:missing:${name}:profile`,
					label: 'Delay profile',
					detail: 'Default profile missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			]
		});
	}

	for (const item of diff.modified ?? []) {
		const modified = asModifiedDelayProfile(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map(formatDelayProfileFieldDiff);

		entities.push({
			id: `delay_profiles:modified:${modified.name}`,
			section: 'delay_profiles',
			sectionLabel: 'Delay Profile',
			title: modified.name,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes
		});
	}

	return entities;
}

function buildMediaManagementEntities(raw: unknown): DriftDisplayEntity[] {
	const diff = asMediaManagementDiff(raw);
	if (!diff) return [];

	const entities: DriftDisplayEntity[] = [];

	for (const item of diff.media_settings.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `media_management:media_settings:missing:${name}`,
			section: 'media_management',
			sectionLabel: 'Media Management',
			title: `Media Settings: ${name}`,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary: 'Profilarr expects this media settings config, but Arr does not have it.',
			changes: [
				{
					id: `media-management-media-settings-missing:${name}:config`,
					label: 'Media Settings',
					detail: 'Missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			]
		});
	}

	for (const item of diff.media_settings.modified ?? []) {
		const modified = asModifiedMediaSettings(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map(formatMediaSettingsFieldDiff);

		entities.push({
			id: `media_management:media_settings:modified:${modified.name}`,
			section: 'media_management',
			sectionLabel: 'Media Management',
			title: `Media Settings: ${modified.name}`,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes
		});
	}

	for (const item of diff.naming.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `media_management:naming:missing:${name}`,
			section: 'media_management',
			sectionLabel: 'Media Management',
			title: `Naming: ${name}`,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary: 'Profilarr expects this naming config, but Arr does not have it.',
			changes: [
				{
					id: `media-management-naming-missing:${name}:config`,
					label: 'Naming',
					detail: 'Missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			]
		});
	}

	for (const item of diff.naming.modified ?? []) {
		const modified = asModifiedNaming(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map(formatNamingFieldDiff);

		entities.push({
			id: `media_management:naming:modified:${modified.name}`,
			section: 'media_management',
			sectionLabel: 'Media Management',
			title: `Naming: ${modified.name}`,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes
		});
	}

	for (const item of diff.quality_definitions.missing ?? []) {
		const name = recordString(item, 'name');
		if (!name) continue;

		entities.push({
			id: `media_management:quality_definitions:missing:${name}`,
			section: 'media_management',
			sectionLabel: 'Media Management',
			title: `Quality Definitions: ${name}`,
			state: 'missing',
			stateLabel: 'Missing',
			tone: 'danger',
			summary: 'Profilarr expects this quality definitions config, but Arr does not have it.',
			changes: [
				{
					id: `media-management-quality-definitions-missing:${name}:config`,
					label: 'Quality definitions',
					detail: 'Missing from Arr',
					expected: value('Present'),
					actual: value('Missing', { tone: 'danger' }),
					tone: 'danger'
				}
			]
		});
	}

	for (const item of diff.quality_definitions.modified ?? []) {
		const modified = asModifiedQualityDefinitions(item);
		if (!modified) continue;
		if (modified.fields.length === 0) continue;

		const changes = modified.fields.map(formatQualityDefinitionFieldDiff);

		entities.push({
			id: `media_management:quality_definitions:modified:${modified.name}`,
			section: 'media_management',
			sectionLabel: 'Media Management',
			title: `Quality Definitions: ${modified.name}`,
			state: 'modified',
			stateLabel: 'Modified',
			tone: 'warning',
			summary: `${changes.length} ${changes.length === 1 ? 'change' : 'changes'} detected`,
			changes
		});
	}

	return entities;
}

function formatQualityProfileFieldDiff(
	field: DriftFieldDiff,
	index: number,
	arrType: SyncArrType | undefined
): DriftDisplayChange {
	const formatMatch = /^formatItems\[(.+)\]$/.exec(field.path);
	if (formatMatch) {
		const formatName = formatMatch[1];
		const actualState = recordString(field.actual, 'state');
		const isMissing = field.actual === null || actualState === 'missing_custom_format';
		const isExtra = recordString(field.expected, 'state') === 'unmanaged';
		let detail = `${formatName} score changed`;
		if (isExtra) {
			detail = `${formatName} has an unmanaged nonzero score`;
		} else if (actualState === 'missing_custom_format') {
			detail = `${formatName} custom format is missing from Arr`;
		} else if (isMissing) {
			detail = `${formatName} is missing from scoring`;
		}

		return {
			id: `quality-profile-format-item:${index}`,
			label: 'Custom format score',
			detail,
			expected: formatQualityProfileFormatItemValue(field.expected),
			actual: formatQualityProfileFormatItemValue(field.actual),
			tone: isMissing ? 'danger' : 'warning'
		};
	}

	if (field.path === 'items') {
		return {
			id: `quality-profile-items:${index}`,
			label: 'Qualities',
			detail: 'Quality list differs from Profilarr expected layout',
			expected: formatQualityItemsValue(field.expected),
			actual: formatQualityItemsValue(field.actual),
			tone: 'warning'
		};
	}

	if (field.path === 'language') {
		return {
			id: `quality-profile-language:${index}`,
			label: 'Language',
			detail: 'Profile language changed',
			expected: formatLanguageValue(field.expected, arrType),
			actual: formatLanguageValue(field.actual, arrType),
			tone: 'warning'
		};
	}

	if (field.path === 'upgradeAllowed') {
		return {
			id: `quality-profile-upgrade-allowed:${index}`,
			label: 'Upgrade Allowed',
			detail: 'Upgrade behavior changed',
			expected: formatBooleanValue(field.expected),
			actual: formatBooleanValue(field.actual),
			tone: 'warning'
		};
	}

	return {
		id: `quality-profile-field:${index}`,
		label: qualityProfileFieldLabel(field.path),
		detail: 'Profile setting changed',
		expected: formatGenericValue(field.expected),
		actual: formatGenericValue(field.actual),
		tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
	};
}

function formatDelayProfileFieldDiff(field: DriftFieldDiff, index: number): DriftDisplayChange {
	if (field.path === 'protocol') {
		return {
			id: `delay-profile-protocol:${index}`,
			label: 'Protocol',
			detail: 'Protocol preference changed',
			expected: formatDelayProtocolValue(field.expected),
			actual: formatDelayProtocolValue(field.actual),
			tone: 'warning'
		};
	}

	if (field.path === 'usenetDelay' || field.path === 'torrentDelay') {
		return {
			id: `delay-profile-delay:${index}`,
			label: delayProfileFieldLabel(field.path),
			detail: 'Delay changed',
			expected: formatMinutesValue(field.expected),
			actual: formatMinutesValue(field.actual),
			tone: 'warning'
		};
	}

	if (field.path === 'bypassIfHighestQuality' || field.path === 'bypassIfAboveCustomFormatScore') {
		return {
			id: `delay-profile-bypass:${index}`,
			label: delayProfileFieldLabel(field.path),
			detail: 'Bypass behavior changed',
			expected: formatBooleanValue(field.expected),
			actual: formatBooleanValue(field.actual),
			tone: 'warning'
		};
	}

	if (field.path === 'minimumCustomFormatScore') {
		return {
			id: `delay-profile-minimum-score:${index}`,
			label: 'Minimum Custom Format Score',
			detail: 'Bypass score threshold changed',
			expected: formatGenericValue(field.expected),
			actual: formatGenericValue(field.actual),
			tone: 'warning'
		};
	}

	if (field.path === 'tags') {
		return {
			id: `delay-profile-tags:${index}`,
			label: 'Tags',
			detail: 'Default profile tags changed',
			expected: formatTagIdsValue(field.expected),
			actual: formatTagIdsValue(field.actual),
			tone: 'warning'
		};
	}

	return {
		id: `delay-profile-field:${index}`,
		label: delayProfileFieldLabel(field.path),
		detail: 'Delay profile setting changed',
		expected: formatGenericValue(field.expected),
		actual: formatGenericValue(field.actual),
		tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
	};
}

function formatMediaSettingsFieldDiff(field: DriftFieldDiff, index: number): DriftDisplayChange {
	if (field.path === 'downloadPropersAndRepacks') {
		return {
			id: `media-settings-propers-repacks:${index}`,
			label: 'Propers and Repacks',
			detail: 'Propers and repacks preference changed',
			expected: formatPropersRepacksValue(field.expected),
			actual: formatPropersRepacksValue(field.actual),
			tone: 'warning'
		};
	}

	if (field.path === 'enableMediaInfo') {
		return {
			id: `media-settings-enable-media-info:${index}`,
			label: 'Enable Media Info',
			detail: 'Media info parsing changed',
			expected: formatBooleanValue(field.expected),
			actual: formatBooleanValue(field.actual),
			tone: 'warning'
		};
	}

	return {
		id: `media-settings-field:${index}`,
		label: titleize(field.path),
		detail: 'Media setting changed',
		expected: formatGenericValue(field.expected),
		actual: formatGenericValue(field.actual),
		tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
	};
}

function formatNamingFieldDiff(field: DriftFieldDiff, index: number): DriftDisplayChange {
	return {
		id: `naming-field:${index}`,
		label: namingFieldLabel(field.path),
		detail: 'Naming setting changed',
		expected: formatNamingValue(field.path, field.expected),
		actual: formatNamingValue(field.path, field.actual),
		tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
	};
}

function formatQualityDefinitionFieldDiff(
	field: DriftFieldDiff,
	index: number
): DriftDisplayChange {
	const parsed = parseQualityDefinitionPath(field.path);
	const qualityName = parsed?.qualityName ?? 'Quality definition';
	const label = parsed
		? qualityDefinitionFieldLabel(parsed.field)
		: qualityDefinitionFieldLabel(field.path);

	return {
		id: `quality-definition-field:${index}`,
		label: qualityName,
		detail: `${label} changed`,
		expected: formatQualityDefinitionValue(parsed?.field ?? field.path, field.expected),
		actual: formatQualityDefinitionValue(parsed?.field ?? field.path, field.actual),
		tone: 'warning'
	};
}

function asQualityItems(raw: unknown): DriftDisplayQualityItem[] | null {
	if (!Array.isArray(raw)) return null;
	const items: DriftDisplayQualityItem[] = [];
	for (const item of raw) {
		const parsed = asQualityItem(item);
		if (!parsed) return null;
		items.push(parsed);
	}
	return items;
}

function asQualityItem(raw: unknown): DriftDisplayQualityItem | null {
	if (!isRecord(raw)) return null;
	const type = recordString(raw, 'type');
	const name = recordString(raw, 'name');
	if ((type !== 'quality' && type !== 'group') || !name || typeof raw.id !== 'number') {
		return null;
	}

	const item: DriftDisplayQualityItem = {
		type,
		id: raw.id,
		name,
		allowed: raw.allowed !== false,
		upgradeUntil: raw.upgradeUntil === true
	};

	if (type === 'group') {
		const members = asQualityItems(raw.items);
		item.items = members ?? [];
	}

	return item;
}

function formatCustomFormatFieldDiff(
	field: DriftFieldDiff,
	index: number,
	arrType: SyncArrType | undefined
): DriftDisplayChange {
	if (field.path === 'includeCustomFormatWhenRenaming') {
		return {
			id: `include-in-rename:${index}`,
			label: 'Include in Rename',
			detail: 'Rename behavior changed',
			expected: formatBooleanValue(field.expected),
			actual: formatBooleanValue(field.actual),
			tone: 'warning'
		};
	}

	const specPath = parseSpecificationPath(field.path);
	if (!specPath) {
		return {
			id: `custom-format-field:${index}`,
			label: 'Custom format setting',
			detail: 'Value changed',
			expected: formatGenericValue(field.expected),
			actual: formatGenericValue(field.actual),
			tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
		};
	}

	const label = `${implementationLabel(specPath.implementation)} condition: ${specPath.name}`;

	if (!specPath.member && !specPath.field) {
		return formatSpecificationChange(label, field, arrType, index);
	}

	if (specPath.member === 'negate') {
		return {
			id: `condition-negate:${index}`,
			label,
			detail: 'Match mode changed',
			expected: formatNegateValue(field.expected),
			actual: formatNegateValue(field.actual),
			tone: 'warning'
		};
	}

	if (specPath.member === 'required') {
		return {
			id: `condition-required:${index}`,
			label,
			detail: 'Requirement changed',
			expected: formatRequiredValue(field.expected),
			actual: formatRequiredValue(field.actual),
			tone: 'warning'
		};
	}

	if (specPath.field) {
		return {
			id: `condition-field:${index}`,
			label,
			detail: `${fieldLabel(specPath.implementation, specPath.field)} changed`,
			expected: formatFieldValue(specPath.implementation, specPath.field, field.expected, arrType),
			actual: formatFieldValue(specPath.implementation, specPath.field, field.actual, arrType),
			tone: field.actual === null || field.actual === undefined ? 'danger' : 'warning'
		};
	}

	return {
		id: `condition-setting:${index}`,
		label,
		detail: 'Condition setting changed',
		expected: formatGenericValue(field.expected),
		actual: formatGenericValue(field.actual),
		tone: 'warning'
	};
}

function formatSpecificationChange(
	label: string,
	field: DriftFieldDiff,
	arrType: SyncArrType | undefined,
	index: number
): DriftDisplayChange {
	if (field.actual === null || field.actual === undefined) {
		return {
			id: `condition-missing:${index}`,
			label,
			detail: 'Condition is missing from Arr',
			expected: formatSpecificationValue(field.expected, arrType),
			actual: value('Missing', { tone: 'danger' }),
			tone: 'danger'
		};
	}

	if (field.expected === null || field.expected === undefined) {
		return {
			id: `condition-extra:${index}`,
			label,
			detail: 'Extra condition exists in Arr',
			expected: value('Not present'),
			actual: formatSpecificationValue(field.actual, arrType),
			tone: 'warning'
		};
	}

	return {
		id: `condition-changed:${index}`,
		label,
		detail: 'Condition changed',
		expected: formatSpecificationValue(field.expected, arrType),
		actual: formatSpecificationValue(field.actual, arrType),
		tone: 'warning'
	};
}

function parseSpecificationPath(path: string): ParsedSpecificationPath | null {
	const match = /^specifications\[([^:\]]+):(.+?)\](?:\.(.+))?$/.exec(path);
	if (!match) return null;

	const tail = match[3];
	const parsed: ParsedSpecificationPath = {
		implementation: match[1],
		name: match[2]
	};

	if (!tail) return parsed;

	const fieldMatch = /^fields\[(.+)\]$/.exec(tail);
	if (fieldMatch) {
		parsed.field = fieldMatch[1];
		return parsed;
	}

	parsed.member = tail;
	return parsed;
}

function asCustomFormatDiff(raw: unknown): CustomFormatDiff | null {
	if (!isRecord(raw)) return null;
	return {
		missing: Array.isArray(raw.missing) ? raw.missing : [],
		modified: Array.isArray(raw.modified) ? raw.modified : []
	};
}

function asQualityProfileDiff(raw: unknown): QualityProfileDiff | null {
	if (!isRecord(raw)) return null;
	return {
		missing: Array.isArray(raw.missing) ? raw.missing : [],
		modified: Array.isArray(raw.modified) ? raw.modified : []
	};
}

function asDelayProfileDiff(raw: unknown): DelayProfileDiff | null {
	if (!isRecord(raw)) return null;
	return {
		missing: Array.isArray(raw.missing) ? raw.missing : [],
		modified: Array.isArray(raw.modified) ? raw.modified : []
	};
}

function asMediaManagementDiff(raw: unknown): MediaManagementDiff | null {
	if (!isRecord(raw)) return null;
	const mediaSettings = isRecord(raw.media_settings) ? raw.media_settings : {};
	const naming = isRecord(raw.naming) ? raw.naming : {};
	const qualityDefinitions = isRecord(raw.quality_definitions) ? raw.quality_definitions : {};
	return {
		media_settings: {
			missing: Array.isArray(mediaSettings.missing) ? mediaSettings.missing : [],
			modified: Array.isArray(mediaSettings.modified) ? mediaSettings.modified : []
		},
		naming: {
			missing: Array.isArray(naming.missing) ? naming.missing : [],
			modified: Array.isArray(naming.modified) ? naming.modified : []
		},
		quality_definitions: {
			missing: Array.isArray(qualityDefinitions.missing) ? qualityDefinitions.missing : [],
			modified: Array.isArray(qualityDefinitions.modified) ? qualityDefinitions.modified : []
		}
	};
}

function asModifiedCustomFormat(raw: unknown): CustomFormatModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isFieldDiff);
	return { name, fields };
}

function asModifiedQualityProfile(raw: unknown): QualityProfileModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isFieldDiff);
	return { name, fields };
}

function asModifiedDelayProfile(raw: unknown): DelayProfileModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isFieldDiff);
	return { name, fields };
}

function asModifiedMediaSettings(raw: unknown): MediaSettingsModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isFieldDiff);
	return { name, fields };
}

function asModifiedNaming(raw: unknown): NamingModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isFieldDiff);
	return { name, fields };
}

function asModifiedQualityDefinitions(raw: unknown): QualityDefinitionsModifiedDiff | null {
	if (!isRecord(raw)) return null;
	const name = recordString(raw, 'name');
	if (!name || !Array.isArray(raw.fields)) return null;

	const fields = raw.fields.filter(isQualityDefinitionFieldDiff);
	return { name, fields };
}

function isQualityDefinitionFieldDiff(raw: unknown): raw is DriftFieldDiff {
	return isRecord(raw) && typeof raw.path === 'string' && Object.hasOwn(raw, 'expected');
}

function isFieldDiff(raw: unknown): raw is DriftFieldDiff {
	return (
		isRecord(raw) &&
		typeof raw.path === 'string' &&
		Object.hasOwn(raw, 'expected') &&
		Object.hasOwn(raw, 'actual')
	);
}

function asSpecificationValue(raw: unknown): SpecificationValue | null {
	if (!isRecord(raw)) return null;
	if (typeof raw.name !== 'string' || typeof raw.implementation !== 'string') return null;

	return {
		name: raw.name,
		implementation: raw.implementation,
		negate: Boolean(raw.negate),
		required: Boolean(raw.required),
		fields: Array.isArray(raw.fields)
			? raw.fields.flatMap((field) => {
					if (!isRecord(field) || typeof field.name !== 'string') return [];
					return [{ name: field.name, value: field.value }];
				})
			: []
	};
}

function formatSpecificationValue(
	raw: unknown,
	arrType: SyncArrType | undefined
): DriftDisplayValue {
	const spec = asSpecificationValue(raw);
	if (!spec) return formatGenericValue(raw);

	const fields = spec.fields.map((field) => {
		const formatted = formatFieldValue(spec.implementation, field.name, field.value, arrType);
		return `${fieldLabel(spec.implementation, field.name)}: ${formatted.text}`;
	});
	const modes = [
		spec.required ? 'Required' : 'Optional',
		spec.negate ? 'Must not match' : 'Must match'
	];
	const suffix = [...fields, ...modes].join(', ');

	return value(
		`${implementationLabel(spec.implementation)}: ${spec.name}${suffix ? ` (${suffix})` : ''}`
	);
}

function formatFieldValue(
	implementation: string,
	field: string,
	raw: unknown,
	arrType: SyncArrType | undefined
): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });

	if (field === 'value') {
		if (isPatternImplementation(implementation)) {
			return value(String(raw), { mono: true });
		}
		if (implementation === 'SourceSpecification') {
			return value(mappedName(arrType ? SOURCES[arrType] : undefined, raw) ?? String(raw));
		}
		if (implementation === 'ResolutionSpecification') {
			return value(mappedName(RESOLUTIONS, raw) ?? `${String(raw)}p`);
		}
		if (implementation === 'IndexerFlagSpecification') {
			return value(mappedName(arrType ? INDEXER_FLAGS[arrType] : undefined, raw) ?? String(raw));
		}
		if (implementation === 'QualityModifierSpecification') {
			return value(mappedName(QUALITY_MODIFIERS, raw) ?? String(raw));
		}
		if (implementation === 'ReleaseTypeSpecification') {
			return value(mappedName(RELEASE_TYPES, raw) ?? String(raw));
		}
		if (implementation === 'LanguageSpecification') {
			return value(languageName(arrType, raw) ?? String(raw));
		}
	}

	if (implementation === 'SizeSpecification' && (field === 'min' || field === 'max')) {
		return value(formatBytes(raw));
	}

	if (field === 'exceptLanguage') {
		return formatBooleanValue(raw);
	}

	return formatGenericValue(raw);
}

function formatGenericValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw === 'boolean') return formatBooleanValue(raw);
	if (typeof raw === 'string') return value(raw, { mono: looksTechnical(raw) });
	if (typeof raw === 'number') return value(String(raw), { mono: true });
	if (Array.isArray(raw)) return value(raw.map((item) => formatGenericValue(item).text).join(', '));

	const spec = asSpecificationValue(raw);
	if (spec) return formatSpecificationValue(spec, undefined);

	return value('Structured value');
}

function formatQualityItemsValue(raw: unknown): DriftDisplayValue {
	const items = asQualityItems(raw);
	if (!items) return formatGenericValue(raw);

	return value(`${items.length} top-level ${items.length === 1 ? 'item' : 'items'}`, {
		qualityList: items
	});
}

function formatQualityProfileFormatItemValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) {
		return value('Missing from scoring array', { tone: 'danger' });
	}
	if (!isRecord(raw)) return formatGenericValue(raw);

	const name = recordString(raw, 'name') ?? 'Custom format';
	const state = recordString(raw, 'state');
	if (state === 'missing_custom_format') {
		return value(`${name}: custom format missing`, { tone: 'danger' });
	}
	if (state === 'unmanaged') {
		return value(`${name}: 0 (unmanaged)`, { mono: true });
	}
	if (typeof raw.score === 'number') {
		return value(`${name}: ${raw.score}`, { mono: true });
	}

	return formatGenericValue(raw);
}

function formatDelayProtocolValue(raw: unknown): DriftDisplayValue {
	const labels: Record<string, string> = {
		prefer_usenet: 'Prefer Usenet',
		prefer_torrent: 'Prefer Torrent',
		only_usenet: 'Only Usenet',
		only_torrent: 'Only Torrent',
		unknown: 'Unknown'
	};
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw === 'string') return value(labels[raw] ?? titleize(raw));
	return formatGenericValue(raw);
}

function formatPropersRepacksValue(raw: unknown): DriftDisplayValue {
	const labels: Record<string, string> = {
		doNotPrefer: 'Do Not Prefer',
		preferAndUpgrade: 'Prefer and Upgrade',
		doNotUpgrade: 'Do Not Upgrade Automatically'
	};
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw === 'string') return value(labels[raw] ?? titleize(raw));
	return formatGenericValue(raw);
}

function formatNamingValue(field: string, raw: unknown): DriftDisplayValue {
	if (
		field === 'customColonReplacementFormat' &&
		(raw === null || raw === undefined || raw === '')
	) {
		return value('None');
	}
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw === 'boolean') return formatBooleanValue(raw);
	if (typeof raw === 'string') {
		if (field === 'colonReplacementFormat' || field === 'multiEpisodeStyle') {
			return value(titleize(raw));
		}
		return value(raw, { mono: looksTechnical(raw) });
	}
	return formatGenericValue(raw);
}

function formatQualityDefinitionValue(field: string, raw: unknown): DriftDisplayValue {
	if (
		(field === 'maxSize' || field === 'preferredSize') &&
		(raw === null || raw === undefined || raw === 0)
	) {
		return value('Unlimited');
	}
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw === 'number') return value(String(raw), { mono: true });
	return formatGenericValue(raw);
}

function formatMinutesValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (typeof raw !== 'number') return formatGenericValue(raw);
	return value(`${raw} ${raw === 1 ? 'minute' : 'minutes'}`, { mono: true });
}

function formatTagIdsValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (!Array.isArray(raw)) return formatGenericValue(raw);
	if (raw.length === 0) return value('None');
	return value(raw.map((tag) => String(tag)).join(', '), { mono: true });
}

function formatLanguageValue(raw: unknown, arrType: SyncArrType | undefined): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	if (!isRecord(raw)) return formatGenericValue(raw);

	const id = raw.id;
	const name = recordString(raw, 'name');
	if (typeof id === 'number') {
		return value(name ?? languageName(arrType, id) ?? String(id));
	}

	return formatGenericValue(raw);
}

function formatBooleanValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	return value(raw ? 'Enabled' : 'Disabled', {
		tone: raw ? 'success' : 'neutral'
	});
}

function formatNegateValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	return value(raw ? 'Must not match' : 'Must match');
}

function formatRequiredValue(raw: unknown): DriftDisplayValue {
	if (raw === null || raw === undefined) return value('Missing', { tone: 'danger' });
	return value(raw ? 'Required' : 'Optional');
}

function fieldLabel(implementation: string, field: string): string {
	if (field === 'value') {
		if (isPatternImplementation(implementation)) return 'Pattern';
		if (implementation === 'LanguageSpecification') return 'Language';
		return implementationLabel(implementation);
	}
	if (field === 'min') return 'Minimum';
	if (field === 'max') return 'Maximum';
	if (field === 'exceptLanguage') return 'Except Language';
	return titleize(field);
}

function qualityProfileFieldLabel(path: string): string {
	const labels: Record<string, string> = {
		cutoffFormatScore: 'Cutoff Format Score',
		minFormatScore: 'Minimum Format Score',
		minUpgradeFormatScore: 'Minimum Upgrade Score Increment',
		upgradeAllowed: 'Upgrade Allowed'
	};

	return labels[path] ?? titleize(path);
}

function delayProfileFieldLabel(path: string): string {
	const labels: Record<string, string> = {
		bypassIfAboveCustomFormatScore: 'Bypass if Above Custom Format Score',
		bypassIfHighestQuality: 'Bypass if Highest Quality',
		id: 'ID',
		minimumCustomFormatScore: 'Minimum Custom Format Score',
		order: 'Order',
		protocol: 'Protocol',
		tags: 'Tags',
		torrentDelay: 'Torrent Delay',
		usenetDelay: 'Usenet Delay'
	};

	return labels[path] ?? titleize(path);
}

function namingFieldLabel(path: string): string {
	const labels: Record<string, string> = {
		animeEpisodeFormat: 'Anime Episode Format',
		colonReplacementFormat: 'Colon Replacement',
		customColonReplacementFormat: 'Custom Colon Replacement',
		dailyEpisodeFormat: 'Daily Episode Format',
		movieFolderFormat: 'Movie Folder Format',
		multiEpisodeStyle: 'Multi Episode Style',
		renameEpisodes: 'Rename Episodes',
		renameMovies: 'Rename Movies',
		replaceIllegalCharacters: 'Replace Illegal Characters',
		seasonFolderFormat: 'Season Folder Format',
		seriesFolderFormat: 'Series Folder Format',
		standardEpisodeFormat: 'Standard Episode Format',
		standardMovieFormat: 'Movie Format'
	};

	return labels[path] ?? titleize(path);
}

function qualityDefinitionFieldLabel(path: string): string {
	const labels: Record<string, string> = {
		maxSize: 'Maximum Size',
		minSize: 'Minimum Size',
		preferredSize: 'Preferred Size'
	};

	return labels[path] ?? titleize(path);
}

function parseQualityDefinitionPath(path: string): ParsedQualityDefinitionPath | null {
	const match = /^qualityDefinitions\[(.+)\]\.(.+)$/.exec(path);
	if (!match) return null;
	return {
		qualityName: match[1],
		field: match[2]
	};
}

function implementationLabel(implementation: string): string {
	return (
		IMPLEMENTATION_LABELS[implementation] ?? titleize(implementation.replace(/Specification$/, ''))
	);
}

function isPatternImplementation(implementation: string): boolean {
	return (
		implementation === 'ReleaseTitleSpecification' ||
		implementation === 'ReleaseGroupSpecification' ||
		implementation === 'EditionSpecification'
	);
}

function mappedName(map: Record<string, number> | undefined, raw: unknown): string | null {
	if (typeof raw !== 'number' || !map) return null;
	for (const [key, value] of Object.entries(map)) {
		if (value === raw) return titleizeMappingKey(key);
	}
	return null;
}

function languageName(arrType: SyncArrType | undefined, raw: unknown): string | null {
	if (typeof raw !== 'number' || !arrType) return null;
	for (const language of Object.values(LANGUAGES[arrType])) {
		if (language.id === raw) return language.name;
	}
	return null;
}

function formatBytes(raw: unknown): string {
	if (typeof raw !== 'number' || raw <= 0) return 'None';
	const units = ['B', 'KB', 'MB', 'GB', 'TB'];
	let value = raw;
	let unitIndex = 0;
	while (value >= 1024 && unitIndex < units.length - 1) {
		value = value / 1024;
		unitIndex++;
	}
	const digits = value >= 10 || unitIndex === 0 ? 0 : 1;
	return `${value.toFixed(digits)} ${units[unitIndex]}`;
}

function titleize(value: string): string {
	return value
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/[_-]/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function titleizeMappingKey(value: string): string {
	const label = titleize(value);
	return label
		.replace(/\bTv\b/g, 'TV')
		.replace(/\bDl\b/g, 'DL')
		.replace(/\bHd\b/g, 'HD')
		.replace(/\bRawhd\b/g, 'Raw HD')
		.replace(/\bBrdisk\b/g, 'BR Disk');
}

function looksTechnical(value: string): boolean {
	return /[\\^$.[\]()*+?{}|]/.test(value);
}

function value(
	text: string,
	options: {
		mono?: boolean;
		tone?: DriftDisplayTone;
		qualityList?: DriftDisplayQualityItem[];
	} = {}
): DriftDisplayValue {
	return {
		text,
		mono: options.mono,
		tone: options.tone,
		qualityList: options.qualityList
	};
}

function recordString(raw: unknown, key: string): string | null {
	if (!isRecord(raw)) return null;
	const value = raw[key];
	return typeof value === 'string' ? value : null;
}

function recordNumber(raw: unknown, key: string): number | null {
	if (!isRecord(raw)) return null;
	const value = raw[key];
	return typeof value === 'number' ? value : null;
}

function isRecord(raw: unknown): raw is Record<string, unknown> {
	return typeof raw === 'object' && raw !== null;
}
