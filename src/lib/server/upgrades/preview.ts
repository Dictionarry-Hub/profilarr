import type { ArrInstance } from '$db/queries/arrInstances.ts';
import { RadarrClient } from '$utils/arr/clients/radarr.ts';
import { SonarrClient } from '$utils/arr/clients/sonarr.ts';
import type {
	ArrQualityProfile,
	ArrTag,
	RadarrMovie,
	RadarrMovieFile,
	SonarrSeries
} from '$utils/arr/types.ts';
import {
	evaluateGroup,
	evaluateRule,
	getFilterField,
	isGroup,
	isRule,
	type FilterConfig,
	type FilterField,
	type FilterGroup,
	type FilterRule,
	type UpgradeAppType
} from '$shared/upgrades/filters.ts';
import { getSelector } from '$shared/upgrades/selectors.ts';
import { hasFilterTag, resolveTagLabel } from './cooldown.ts';
import { normalizeRadarrItems, normalizeSonarrItems } from './normalize.ts';
import type { UpgradeItem } from './types.ts';

export type UpgradeFilterPreviewStatus = 'selected' | 'selectable' | 'cooldown' | 'filtered_out';

export interface UpgradeFilterPreviewFormat {
	name: string;
	score: number;
}

export interface UpgradeFilterPreviewDetails {
	qualityProfile: string;
	fileName: string;
	customFormats: UpgradeFilterPreviewFormat[];
	score: number;
	tags: string[];
	monitored: boolean;
	dateAdded: string;
	sizeOnDisk: number;
	releaseGroup: string;
	status: string;
}

export interface UpgradeFilterPreviewItem {
	id: number;
	title: string;
	year: number;
	status: UpgradeFilterPreviewStatus;
	reason: string;
	details: UpgradeFilterPreviewDetails;
}

export interface UpgradeFilterPreviewResult {
	filterName: string;
	totalItems: number;
	matchedCount: number;
	cooldownCount: number;
	selectableCount: number;
	selectedCount: number;
	requestedCount: number;
	selector: string;
	items: UpgradeFilterPreviewItem[];
}

interface RadarrPreviewCacheEntry {
	expiresAt: number;
	movies: RadarrMovie[];
	profiles: ArrQualityProfile[];
	movieFiles: RadarrMovieFile[];
	tags: ArrTag[];
}

interface SonarrPreviewCacheEntry {
	expiresAt: number;
	series: SonarrSeries[];
	profiles: ArrQualityProfile[];
	tags: ArrTag[];
}

interface PreviewLoadResult {
	items: UpgradeItem[];
	tags: ArrTag[];
}

const PREVIEW_CACHE_TTL_MS = 5 * 60 * 1000;
const radarrPreviewCache = new Map<number, RadarrPreviewCacheEntry>();
const sonarrPreviewCache = new Map<number, SonarrPreviewCacheEntry>();

function toPreviewItem(
	item: UpgradeItem,
	status: UpgradeFilterPreviewStatus,
	reason: string
): UpgradeFilterPreviewItem {
	return {
		id: item.id,
		title: item.title,
		year: item.year,
		status,
		reason,
		details: {
			qualityProfile: item.quality_profile,
			fileName: item.file_name,
			customFormats: item.score_breakdown,
			score: item.score,
			tags: item.tags
				.split(',')
				.map((tag) => tag.trim())
				.filter(Boolean),
			monitored: item.monitored,
			dateAdded: item.date_added,
			sizeOnDisk: item.size_on_disk,
			releaseGroup: item.release_group,
			status: item.status
		}
	};
}

function formatValue(value: unknown, field?: FilterField): string {
	if (value === null || value === undefined || value === '') {
		return 'empty';
	}

	const matchingValue = field?.values?.find((option) => Object.is(option.value, value));
	if (matchingValue) {
		return matchingValue.label;
	}

	if (Array.isArray(value)) {
		return value.length > 0 ? value.join(', ') : 'none';
	}

	if (typeof value === 'boolean') {
		return value ? 'True' : 'False';
	}

	return String(value);
}

function pluralize(count: number, singular: string, plural = `${singular}s`): string {
	return `${count} ${count === 1 ? singular : plural}`;
}

function formatFailedRule(item: UpgradeItem, rule: FilterRule, appType: UpgradeAppType): string {
	const field = getFilterField(rule.field, appType);
	const fieldLabel = field?.label ?? rule.field;
	const actualValue =
		rule.field === 'custom_format'
			? item.custom_formats
			: (item as unknown as Record<string, unknown>)[rule.field];
	const expectedValue = formatValue(rule.value, field);
	const actualLabel = formatValue(actualValue, field);

	switch (rule.operator) {
		case 'is':
		case 'eq':
			return `${fieldLabel} is ${actualLabel}, not ${expectedValue}`;
		case 'is_not':
		case 'neq':
			return `${fieldLabel} is ${expectedValue}`;
		case 'contains':
		case 'includes':
			return `${fieldLabel} does not contain ${expectedValue}`;
		case 'not_contains':
		case 'does_not_include':
			return `${fieldLabel} contains ${expectedValue}`;
		case 'starts_with':
			return `${fieldLabel} does not start with ${expectedValue}`;
		case 'ends_with':
			return `${fieldLabel} does not end with ${expectedValue}`;
		case 'is_only':
			return `${fieldLabel} is not only ${expectedValue}`;
		case 'has_any':
			return `${fieldLabel} has none`;
		case 'has_none':
			return `${fieldLabel} has values`;
		case 'gte':
			return field?.valueType === 'number'
				? `${fieldLabel} is below ${expectedValue}`
				: `${fieldLabel} has not reached ${expectedValue}`;
		case 'lte':
			return field?.valueType === 'number'
				? `${fieldLabel} is above ${expectedValue}`
				: `${fieldLabel} has passed ${expectedValue}`;
		case 'gt':
			return `${fieldLabel} is not above ${expectedValue}`;
		case 'lt':
			return `${fieldLabel} is not below ${expectedValue}`;
		case 'before':
			return `${fieldLabel} is not before ${expectedValue}`;
		case 'after':
			return `${fieldLabel} is not after ${expectedValue}`;
		case 'in_last':
			return `${fieldLabel} is not in the last ${expectedValue} days`;
		case 'not_in_last':
			return `${fieldLabel} is in the last ${expectedValue} days`;
		default:
			return `${fieldLabel} did not match`;
	}
}

function explainGroupMismatch(
	item: UpgradeItem,
	group: FilterGroup,
	appType: UpgradeAppType
): string {
	const record = item as unknown as Record<string, unknown>;

	if (group.match === 'all') {
		for (const child of group.children) {
			if (isRule(child) && !evaluateRule(record, child)) {
				return formatFailedRule(item, child, appType);
			}

			if (isGroup(child) && !evaluateGroup(record, child)) {
				return explainGroupMismatch(item, child, appType);
			}
		}
	}

	if (group.match === 'any' && group.children.length > 0) {
		for (const child of group.children) {
			if (isRule(child) && !evaluateRule(record, child)) {
				return `No option matched: ${formatFailedRule(item, child, appType)}`;
			}

			if (isGroup(child) && !evaluateGroup(record, child)) {
				return `No option matched: ${explainGroupMismatch(item, child, appType)}`;
			}
		}
	}

	return 'Filter rules did not match';
}

async function loadRadarrItems(
	instanceId: number,
	client: RadarrClient,
	filter: FilterConfig
): Promise<PreviewLoadResult> {
	const cached = radarrPreviewCache.get(instanceId);
	const now = Date.now();
	let movies: RadarrMovie[];
	let profiles: ArrQualityProfile[];
	let movieFiles: RadarrMovieFile[];
	let tags: ArrTag[];

	if (cached && cached.expiresAt > now) {
		movies = cached.movies;
		profiles = cached.profiles;
		movieFiles = cached.movieFiles;
		tags = cached.tags;
	} else {
		const [loadedMovies, loadedProfiles] = await Promise.all([
			client.getMovies(),
			client.getQualityProfiles()
		]);
		const movieIdsWithFiles = loadedMovies
			.filter((movie) => movie.hasFile)
			.map((movie) => movie.id);
		const loadedMovieFiles = await client.getMovieFiles(movieIdsWithFiles);
		const loadedTags = await client.getTags();

		movies = loadedMovies;
		profiles = loadedProfiles;
		movieFiles = loadedMovieFiles;
		tags = loadedTags;

		radarrPreviewCache.set(instanceId, {
			expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
			movies,
			profiles,
			movieFiles,
			tags
		});
	}

	const movieFileMap = new Map<number, RadarrMovieFile>(
		movieFiles.map((movieFile) => [movieFile.movieId, movieFile])
	);
	const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
	const tagMap = new Map(tags.map((tag) => [tag.id, tag.label]));
	const items = normalizeRadarrItems(movies, movieFileMap, profileMap, filter.cutoff, tagMap);

	return {
		items,
		tags
	};
}

async function loadSonarrItems(
	instanceId: number,
	client: SonarrClient,
	filter: FilterConfig
): Promise<PreviewLoadResult> {
	const cached = sonarrPreviewCache.get(instanceId);
	const now = Date.now();
	let series: SonarrSeries[];
	let profiles: ArrQualityProfile[];
	let tags: ArrTag[];

	if (cached && cached.expiresAt > now) {
		series = cached.series;
		profiles = cached.profiles;
		tags = cached.tags;
	} else {
		const [loadedSeries, loadedProfiles] = await Promise.all([
			client.getAllSeries(),
			client.getQualityProfiles()
		]);
		const loadedTags = await client.getTags();

		series = loadedSeries;
		profiles = loadedProfiles;
		tags = loadedTags;

		sonarrPreviewCache.set(instanceId, {
			expiresAt: Date.now() + PREVIEW_CACHE_TTL_MS,
			series,
			profiles,
			tags
		});
	}

	const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
	const tagMap = new Map(tags.map((tag) => [tag.id, tag.label]));
	const items = normalizeSonarrItems(series, profileMap, filter.cutoff, tagMap);

	return {
		items,
		tags
	};
}

function buildPreview(
	filter: FilterConfig,
	normalizedItems: UpgradeItem[],
	tags: ArrTag[],
	appType: UpgradeAppType
): UpgradeFilterPreviewResult {
	const matchedItems = normalizedItems.filter((item) =>
		evaluateGroup(item as unknown as Record<string, unknown>, filter.group)
	);
	const matchedIds = new Set(matchedItems.map((item) => item.id));

	const tagLabel = resolveTagLabel(filter);
	const cooldownItems = matchedItems.filter((item) => hasFilterTag(item._tags, tags, tagLabel));
	const cooldownIds = new Set(cooldownItems.map((item) => item.id));
	const selectableItems = matchedItems.filter((item) => !cooldownIds.has(item.id));

	const selector = getSelector(filter.selector);
	const orderedSelectableItems = selector
		? selector.select(selectableItems, selectableItems.length)
		: selectableItems;
	const selectedItems = orderedSelectableItems.slice(0, Math.max(0, filter.count));
	const selectedIds = new Set(selectedItems.map((item) => item.id));
	const remainingSelectableItems = orderedSelectableItems.filter(
		(item) => !selectedIds.has(item.id)
	);

	const filteredOutItems = normalizedItems.filter((item) => !matchedIds.has(item.id));
	const selectorLabel = selector?.label ?? filter.selector;
	const cooldownRemaining = pluralize(selectableItems.length, 'item');
	const cooldownReason =
		selectableItems.length > 0
			? `Already searched by this filter. ${cooldownRemaining} still eligible before the cooldown resets.`
			: 'Already searched by this filter. Cooldown will reset on the next run.';

	return {
		filterName: filter.name,
		totalItems: normalizedItems.length,
		matchedCount: matchedItems.length,
		cooldownCount: cooldownItems.length,
		selectableCount: selectableItems.length,
		selectedCount: selectedItems.length,
		requestedCount: filter.count,
		selector: filter.selector,
		items: [
			...selectedItems.map((item) =>
				toPreviewItem(item, 'selected', `Will search next using ${selectorLabel}`)
			),
			...remainingSelectableItems.map((item) =>
				toPreviewItem(item, 'selectable', 'Matches this filter and is waiting for a later run')
			),
			...cooldownItems.map((item) => toPreviewItem(item, 'cooldown', cooldownReason)),
			...filteredOutItems.map((item) =>
				toPreviewItem(item, 'filtered_out', explainGroupMismatch(item, filter.group, appType))
			)
		]
	};
}

export async function previewUpgradeFilter(
	instance: ArrInstance,
	filter: FilterConfig
): Promise<UpgradeFilterPreviewResult> {
	if (instance.type !== 'radarr' && instance.type !== 'sonarr') {
		throw new Error(`Upgrade preview is not supported for ${instance.type}`);
	}

	const appType = instance.type as UpgradeAppType;
	const client =
		instance.type === 'radarr'
			? new RadarrClient(instance.url, instance.api_key, { timeout: 120000 })
			: new SonarrClient(instance.url, instance.api_key, { timeout: 120000 });

	try {
		const { items, tags } =
			instance.type === 'radarr'
				? await loadRadarrItems(instance.id, client as RadarrClient, filter)
				: await loadSonarrItems(instance.id, client as SonarrClient, filter);
		return buildPreview(filter, items, tags, appType);
	} finally {
		client.close();
	}
}
