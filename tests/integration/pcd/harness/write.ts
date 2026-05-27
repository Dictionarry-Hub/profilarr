import { assert } from '@std/assert';
import type { OpOrigin, PcdTestContext } from './pcd.ts';
import type { ConditionData } from '$shared/pcd/display.ts';

export interface RegexFormInput {
	name: string;
	pattern: string;
	description?: string | null;
	tags?: string[];
	regex101Id?: string | null;
	layer?: OpOrigin;
}

export interface CustomFormatFormInput {
	name: string;
	description?: string | null;
	includeInRename?: boolean;
	tags?: string[];
	layer?: OpOrigin;
}

export interface QualityProfileGeneralFormInput {
	name: string;
	description?: string | null;
	tags?: string[];
	language?: string | null;
	layer?: OpOrigin;
}

export interface QualityProfileScoreInput {
	customFormatName: string;
	arrType?: 'all' | 'radarr' | 'sonarr';
	score: number | null;
}

export interface QualityProfileQualityItemInput {
	type: 'quality' | 'group';
	name: string;
	position: number;
	enabled: boolean;
	upgradeUntil: boolean;
	members?: Array<{ name: string }>;
}

export interface QualityProfileScoringFormInput {
	upgradesAllowed?: boolean;
	minimumScore?: number;
	upgradeUntilScore?: number;
	upgradeScoreIncrement?: number;
	customFormatScores?: QualityProfileScoreInput[];
	layer?: OpOrigin;
}

export interface QualityProfileQualitiesFormInput {
	orderedItems: QualityProfileQualityItemInput[];
	layer?: OpOrigin;
}

export interface DelayProfileFormInput {
	name: string;
	preferredProtocol?: 'prefer_usenet' | 'prefer_torrent' | 'only_usenet' | 'only_torrent';
	usenetDelay?: number;
	torrentDelay?: number;
	bypassIfHighestQuality?: boolean;
	bypassIfAboveCfScore?: boolean;
	minimumCfScore?: number;
	layer?: OpOrigin;
}

export type MediaSettingsArrType = 'radarr' | 'sonarr';

export interface MediaSettingsFormInput {
	name: string;
	propersRepacks?: 'doNotPrefer' | 'doNotUpgradeAutomatically' | 'preferAndUpgrade';
	enableMediaInfo?: boolean;
	layer?: OpOrigin;
}

export type RadarrColonFormat = 'delete' | 'dash' | 'spaceDash' | 'spaceDashSpace' | 'smart';
export type SonarrColonFormat =
	| 'delete'
	| 'dash'
	| 'spaceDash'
	| 'spaceDashSpace'
	| 'smart'
	| 'custom';
export type SonarrMultiEpisodeStyle =
	| 'extend'
	| 'duplicate'
	| 'repeat'
	| 'scene'
	| 'range'
	| 'prefixedRange';

export const VALID_RADARR_NAMING_DEFAULTS = {
	movieFormat: '{Movie Title} ({Release Year})',
	movieFolderFormat: '{Movie Title}'
} as const;

export const VALID_SONARR_NAMING_DEFAULTS = {
	standardEpisodeFormat: '{Series Title} - S{season:00}E{episode:00}',
	dailyEpisodeFormat: '{Series Title} - {Air-Date}',
	animeEpisodeFormat: '{Series Title} - {absolute:000}',
	seriesFolderFormat: '{Series Title}',
	seasonFolderFormat: 'Season {season:00}'
} as const;

export interface RadarrNamingFormInput {
	name: string;
	rename?: boolean;
	movieFormat?: string;
	movieFolderFormat?: string;
	replaceIllegalCharacters?: boolean;
	colonReplacementFormat?: RadarrColonFormat;
	layer?: OpOrigin;
}

export interface QualityDefinitionEntryInput {
	quality_name: string;
	min_size: number;
	max_size: number;
	preferred_size: number;
}

export interface QualityDefinitionsFormInput {
	name: string;
	entries: QualityDefinitionEntryInput[];
	layer?: OpOrigin;
}

export interface SonarrNamingFormInput {
	name: string;
	rename?: boolean;
	standardEpisodeFormat?: string;
	dailyEpisodeFormat?: string;
	animeEpisodeFormat?: string;
	seriesFolderFormat?: string;
	seasonFolderFormat?: string;
	replaceIllegalCharacters?: boolean;
	colonReplacementFormat?: SonarrColonFormat;
	customColonReplacementFormat?: string | null;
	multiEpisodeStyle?: SonarrMultiEpisodeStyle;
	layer?: OpOrigin;
}

export const write = {
	customFormat: {
		create: createCustomFormat,
		update: updateCustomFormat,
		updateConditions: updateCustomFormatConditions,
		remove: removeCustomFormat,
		submitCreate: submitCreateCustomFormat,
		submitUpdate: submitUpdateCustomFormat,
		submitUpdateConditions: submitUpdateCustomFormatConditions,
		submitRemove: submitRemoveCustomFormat
	},
	delayProfile: {
		create: createDelayProfile,
		update: updateDelayProfile,
		remove: removeDelayProfile,
		submitCreate: submitCreateDelayProfile,
		submitUpdate: submitUpdateDelayProfile,
		submitRemove: submitRemoveDelayProfile
	},
	regex: {
		create: createRegex,
		update: updateRegex,
		remove: removeRegex,
		submitCreate: submitCreateRegex,
		submitUpdate: submitUpdateRegex,
		submitRemove: submitRemoveRegex
	},
	qualityProfile: {
		create: createQualityProfile,
		updateGeneral: updateQualityProfileGeneral,
		updateScoring: updateQualityProfileScoring,
		updateQualities: updateQualityProfileQualities,
		remove: removeQualityProfile,
		submitCreate: submitCreateQualityProfile,
		submitUpdateGeneral: submitUpdateQualityProfileGeneral,
		submitUpdateScoring: submitUpdateQualityProfileScoring,
		submitUpdateQualities: submitUpdateQualityProfileQualities,
		submitRemove: submitRemoveQualityProfile
	},
	mediaSettings: {
		create: createMediaSettings,
		update: updateMediaSettings,
		remove: removeMediaSettings,
		submitCreate: submitCreateMediaSettings,
		submitUpdate: submitUpdateMediaSettings,
		submitRemove: submitRemoveMediaSettings
	},
	namingRadarr: {
		create: createRadarrNaming,
		update: updateRadarrNaming,
		remove: removeRadarrNaming,
		submitCreate: submitCreateRadarrNaming,
		submitUpdate: submitUpdateRadarrNaming,
		submitRemove: submitRemoveRadarrNaming
	},
	namingSonarr: {
		create: createSonarrNaming,
		update: updateSonarrNaming,
		remove: removeSonarrNaming,
		submitCreate: submitCreateSonarrNaming,
		submitUpdate: submitUpdateSonarrNaming,
		submitRemove: submitRemoveSonarrNaming
	},
	qualityDefRadarr: {
		create: createRadarrQualityDefinitions,
		update: updateRadarrQualityDefinitions,
		remove: removeRadarrQualityDefinitions,
		submitCreate: submitCreateRadarrQualityDefinitions,
		submitUpdate: submitUpdateRadarrQualityDefinitions,
		submitRemove: submitRemoveRadarrQualityDefinitions
	},
	qualityDefSonarr: {
		create: createSonarrQualityDefinitions,
		update: updateSonarrQualityDefinitions,
		remove: removeSonarrQualityDefinitions,
		submitCreate: submitCreateSonarrQualityDefinitions,
		submitUpdate: submitUpdateSonarrQualityDefinitions,
		submitRemove: submitRemoveSonarrQualityDefinitions
	}
};

export async function createCustomFormat(
	ctx: PcdTestContext,
	input: CustomFormatFormInput
): Promise<Response> {
	return assertSuccessfulAction(await submitCreateCustomFormat(ctx, input), 'create custom format');
}

export async function updateCustomFormat(
	ctx: PcdTestContext,
	id: number,
	input: CustomFormatFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateCustomFormat(ctx, id, input),
		'update custom format'
	);
}

export async function removeCustomFormat(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveCustomFormat(ctx, id, layer),
		'delete custom format'
	);
}

export async function updateCustomFormatConditions(
	ctx: PcdTestContext,
	id: number,
	conditions: ConditionData[],
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateCustomFormatConditions(ctx, id, conditions, layer),
		'update custom format conditions'
	);
}

export async function submitCreateCustomFormat(
	ctx: PcdTestContext,
	input: CustomFormatFormInput
): Promise<Response> {
	return ctx.client.postForm(`/custom-formats/${ctx.dbId}/new`, customFormatFields(input), {
		headers: { Origin: ctx.origin }
	});
}

export async function submitUpdateCustomFormat(
	ctx: PcdTestContext,
	id: number,
	input: CustomFormatFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/custom-formats/${ctx.dbId}/${id}/general?/update`,
		customFormatFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateCustomFormatConditions(
	ctx: PcdTestContext,
	id: number,
	conditions: ConditionData[],
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/custom-formats/${ctx.dbId}/${id}/conditions?/update`,
		customFormatConditionsFields(conditions, layer),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveCustomFormat(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/custom-formats/${ctx.dbId}/${id}/general?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

export async function createQualityProfile(
	ctx: PcdTestContext,
	input: QualityProfileGeneralFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitCreateQualityProfile(ctx, input),
		'create quality profile'
	);
}

export async function updateQualityProfileGeneral(
	ctx: PcdTestContext,
	id: number,
	input: QualityProfileGeneralFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateQualityProfileGeneral(ctx, id, input),
		'update quality profile'
	);
}

export async function removeQualityProfile(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveQualityProfile(ctx, id, layer),
		'delete quality profile'
	);
}

export async function updateQualityProfileScoring(
	ctx: PcdTestContext,
	id: number,
	input: QualityProfileScoringFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateQualityProfileScoring(ctx, id, input),
		'update quality profile scoring'
	);
}

export async function updateQualityProfileQualities(
	ctx: PcdTestContext,
	id: number,
	input: QualityProfileQualitiesFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateQualityProfileQualities(ctx, id, input),
		'update quality profile qualities'
	);
}

export async function submitCreateQualityProfile(
	ctx: PcdTestContext,
	input: QualityProfileGeneralFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/quality-profiles/${ctx.dbId}/new`,
		qualityProfileGeneralFields(input),
		{
			headers: { Origin: ctx.origin }
		}
	);
}

export async function submitUpdateQualityProfileGeneral(
	ctx: PcdTestContext,
	id: number,
	input: QualityProfileGeneralFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/quality-profiles/${ctx.dbId}/${id}/general?/update`,
		qualityProfileGeneralFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateQualityProfileScoring(
	ctx: PcdTestContext,
	id: number,
	input: QualityProfileScoringFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/quality-profiles/${ctx.dbId}/${id}/scoring?/update`,
		qualityProfileScoringFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateQualityProfileQualities(
	ctx: PcdTestContext,
	id: number,
	input: QualityProfileQualitiesFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/quality-profiles/${ctx.dbId}/${id}/qualities?/update`,
		qualityProfileQualitiesFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveQualityProfile(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/quality-profiles/${ctx.dbId}/${id}/general?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

export async function createDelayProfile(
	ctx: PcdTestContext,
	input: DelayProfileFormInput
): Promise<Response> {
	return assertSuccessfulAction(await submitCreateDelayProfile(ctx, input), 'create delay profile');
}

export async function updateDelayProfile(
	ctx: PcdTestContext,
	currentName: string,
	input: DelayProfileFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateDelayProfile(ctx, currentName, input),
		'update delay profile'
	);
}

export async function removeDelayProfile(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveDelayProfile(ctx, currentName, layer),
		'delete delay profile'
	);
}

export async function submitCreateDelayProfile(
	ctx: PcdTestContext,
	input: DelayProfileFormInput
): Promise<Response> {
	return ctx.client.postForm(`/delay-profiles/${ctx.dbId}/new`, delayProfileFields(input), {
		headers: { Origin: ctx.origin }
	});
}

export async function submitUpdateDelayProfile(
	ctx: PcdTestContext,
	currentName: string,
	input: DelayProfileFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/delay-profiles/${ctx.dbId}/${encodeURIComponent(currentName)}?/update`,
		delayProfileFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveDelayProfile(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/delay-profiles/${ctx.dbId}/${encodeURIComponent(currentName)}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

export async function createRegex(ctx: PcdTestContext, input: RegexFormInput): Promise<Response> {
	return assertSuccessfulAction(await submitCreateRegex(ctx, input), 'create regex');
}

export async function updateRegex(
	ctx: PcdTestContext,
	id: number,
	input: RegexFormInput
): Promise<Response> {
	return assertSuccessfulAction(await submitUpdateRegex(ctx, id, input), 'update regex');
}

export async function removeRegex(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(await submitRemoveRegex(ctx, id, layer), 'delete regex');
}

export async function submitCreateRegex(
	ctx: PcdTestContext,
	input: RegexFormInput
): Promise<Response> {
	return ctx.client.postForm(`/regular-expressions/${ctx.dbId}/new`, regexFields(input), {
		headers: { Origin: ctx.origin }
	});
}

export async function submitUpdateRegex(
	ctx: PcdTestContext,
	id: number,
	input: RegexFormInput
): Promise<Response> {
	return ctx.client.postForm(`/regular-expressions/${ctx.dbId}/${id}?/update`, regexFields(input), {
		headers: { Origin: ctx.origin }
	});
}

export async function submitRemoveRegex(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/regular-expressions/${ctx.dbId}/${id}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

function customFormatFields(input: CustomFormatFormInput): Record<string, string> {
	return {
		name: input.name,
		description: input.description ?? '',
		tags: JSON.stringify(input.tags ?? []),
		includeInRename: String(input.includeInRename ?? false),
		layer: input.layer ?? 'user'
	};
}

function customFormatConditionsFields(
	conditions: ConditionData[],
	layer: OpOrigin
): Record<string, string> {
	return {
		conditions: JSON.stringify(conditions),
		layer
	};
}

function qualityProfileGeneralFields(
	input: QualityProfileGeneralFormInput
): Record<string, string> {
	return {
		name: input.name,
		description: input.description ?? '',
		tags: JSON.stringify(input.tags ?? []),
		language: input.language ?? '',
		layer: input.layer ?? 'user'
	};
}

function qualityProfileScoringFields(
	input: QualityProfileScoringFormInput
): Record<string, string> {
	return {
		upgradesAllowed: String(input.upgradesAllowed ?? true),
		minimumScore: String(input.minimumScore ?? 0),
		upgradeUntilScore: String(input.upgradeUntilScore ?? 0),
		upgradeScoreIncrement: String(input.upgradeScoreIncrement ?? 1),
		customFormatScores: JSON.stringify(
			(input.customFormatScores ?? []).map((score) => ({
				customFormatName: score.customFormatName,
				arrType: score.arrType ?? 'all',
				score: score.score
			}))
		),
		layer: input.layer ?? 'user'
	};
}

function qualityProfileQualitiesFields(
	input: QualityProfileQualitiesFormInput
): Record<string, string> {
	return {
		orderedItems: JSON.stringify(input.orderedItems),
		layer: input.layer ?? 'user'
	};
}

function regexFields(input: RegexFormInput): Record<string, string> {
	return {
		name: input.name,
		pattern: input.pattern,
		description: input.description ?? '',
		tags: JSON.stringify(input.tags ?? []),
		regex101Id: input.regex101Id ?? '',
		layer: input.layer ?? 'user'
	};
}

function delayProfileFields(input: DelayProfileFormInput): Record<string, string> {
	return {
		name: input.name,
		preferredProtocol: input.preferredProtocol ?? 'prefer_usenet',
		usenetDelay: String(input.usenetDelay ?? 0),
		torrentDelay: String(input.torrentDelay ?? 0),
		bypassIfHighestQuality: String(input.bypassIfHighestQuality ?? false),
		bypassIfAboveCfScore: String(input.bypassIfAboveCfScore ?? false),
		minimumCfScore: String(input.minimumCfScore ?? 0),
		layer: input.layer ?? 'user'
	};
}

export async function createMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	input: MediaSettingsFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitCreateMediaSettings(ctx, arrType, input),
		`create ${arrType} media settings`
	);
}

export async function updateMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	currentName: string,
	input: MediaSettingsFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateMediaSettings(ctx, arrType, currentName, input),
		`update ${arrType} media settings`
	);
}

export async function removeMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveMediaSettings(ctx, arrType, currentName, layer),
		`delete ${arrType} media settings`
	);
}

export async function submitCreateMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	input: MediaSettingsFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/media-settings/new`,
		mediaSettingsFields(input, arrType),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	currentName: string,
	input: MediaSettingsFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/media-settings/${arrType}/${encodeURIComponent(currentName)}?/update`,
		mediaSettingsFields(input, arrType),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveMediaSettings(
	ctx: PcdTestContext,
	arrType: MediaSettingsArrType,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/media-settings/${arrType}/${encodeURIComponent(currentName)}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

function mediaSettingsFields(
	input: MediaSettingsFormInput,
	arrType: MediaSettingsArrType
): Record<string, string> {
	return {
		arrType,
		name: input.name,
		propersRepacks: input.propersRepacks ?? 'doNotPrefer',
		enableMediaInfo: String(input.enableMediaInfo ?? false),
		layer: input.layer ?? 'user'
	};
}

export async function createRadarrNaming(
	ctx: PcdTestContext,
	input: RadarrNamingFormInput
): Promise<Response> {
	return assertSuccessfulAction(await submitCreateRadarrNaming(ctx, input), 'create radarr naming');
}

export async function updateRadarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	input: RadarrNamingFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateRadarrNaming(ctx, currentName, input),
		'update radarr naming'
	);
}

export async function removeRadarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveRadarrNaming(ctx, currentName, layer),
		'delete radarr naming'
	);
}

export async function submitCreateRadarrNaming(
	ctx: PcdTestContext,
	input: RadarrNamingFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/naming/new`,
		radarrNamingFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateRadarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	input: RadarrNamingFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/naming/radarr/${encodeURIComponent(currentName)}?/update`,
		radarrNamingFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveRadarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/naming/radarr/${encodeURIComponent(currentName)}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

export async function createSonarrNaming(
	ctx: PcdTestContext,
	input: SonarrNamingFormInput
): Promise<Response> {
	return assertSuccessfulAction(await submitCreateSonarrNaming(ctx, input), 'create sonarr naming');
}

export async function updateSonarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	input: SonarrNamingFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateSonarrNaming(ctx, currentName, input),
		'update sonarr naming'
	);
}

export async function removeSonarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveSonarrNaming(ctx, currentName, layer),
		'delete sonarr naming'
	);
}

export async function submitCreateSonarrNaming(
	ctx: PcdTestContext,
	input: SonarrNamingFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/naming/new`,
		sonarrNamingFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateSonarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	input: SonarrNamingFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/naming/sonarr/${encodeURIComponent(currentName)}?/update`,
		sonarrNamingFields(input),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveSonarrNaming(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/naming/sonarr/${encodeURIComponent(currentName)}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

function radarrNamingFields(input: RadarrNamingFormInput): Record<string, string> {
	return {
		arrType: 'radarr',
		name: input.name,
		rename: String(input.rename ?? true),
		movieFormat: input.movieFormat ?? VALID_RADARR_NAMING_DEFAULTS.movieFormat,
		movieFolderFormat: input.movieFolderFormat ?? VALID_RADARR_NAMING_DEFAULTS.movieFolderFormat,
		replaceIllegalCharacters: String(input.replaceIllegalCharacters ?? false),
		colonReplacementFormat: input.colonReplacementFormat ?? 'delete',
		layer: input.layer ?? 'user'
	};
}

function sonarrNamingFields(input: SonarrNamingFormInput): Record<string, string> {
	return {
		arrType: 'sonarr',
		name: input.name,
		rename: String(input.rename ?? true),
		standardEpisodeFormat:
			input.standardEpisodeFormat ?? VALID_SONARR_NAMING_DEFAULTS.standardEpisodeFormat,
		dailyEpisodeFormat: input.dailyEpisodeFormat ?? VALID_SONARR_NAMING_DEFAULTS.dailyEpisodeFormat,
		animeEpisodeFormat: input.animeEpisodeFormat ?? VALID_SONARR_NAMING_DEFAULTS.animeEpisodeFormat,
		seriesFolderFormat: input.seriesFolderFormat ?? VALID_SONARR_NAMING_DEFAULTS.seriesFolderFormat,
		seasonFolderFormat: input.seasonFolderFormat ?? VALID_SONARR_NAMING_DEFAULTS.seasonFolderFormat,
		replaceIllegalCharacters: String(input.replaceIllegalCharacters ?? false),
		colonReplacementFormat: input.colonReplacementFormat ?? 'delete',
		customColonReplacementFormat: input.customColonReplacementFormat ?? '',
		multiEpisodeStyle: input.multiEpisodeStyle ?? 'extend',
		layer: input.layer ?? 'user'
	};
}

export async function createRadarrQualityDefinitions(
	ctx: PcdTestContext,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitCreateRadarrQualityDefinitions(ctx, input),
		'create radarr quality definitions'
	);
}

export async function updateRadarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateRadarrQualityDefinitions(ctx, currentName, input),
		'update radarr quality definitions'
	);
}

export async function removeRadarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveRadarrQualityDefinitions(ctx, currentName, layer),
		'delete radarr quality definitions'
	);
}

export async function submitCreateRadarrQualityDefinitions(
	ctx: PcdTestContext,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/quality-definitions/new`,
		qualityDefinitionsFields(input, 'radarr'),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateRadarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/quality-definitions/radarr/${encodeURIComponent(currentName)}?/update`,
		qualityDefinitionsFields(input, 'radarr'),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveRadarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/quality-definitions/radarr/${encodeURIComponent(currentName)}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

export async function createSonarrQualityDefinitions(
	ctx: PcdTestContext,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitCreateSonarrQualityDefinitions(ctx, input),
		'create sonarr quality definitions'
	);
}

export async function updateSonarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await submitUpdateSonarrQualityDefinitions(ctx, currentName, input),
		'update sonarr quality definitions'
	);
}

export async function removeSonarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await submitRemoveSonarrQualityDefinitions(ctx, currentName, layer),
		'delete sonarr quality definitions'
	);
}

export async function submitCreateSonarrQualityDefinitions(
	ctx: PcdTestContext,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/quality-definitions/new`,
		qualityDefinitionsFields(input, 'sonarr'),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitUpdateSonarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	input: QualityDefinitionsFormInput
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/quality-definitions/sonarr/${encodeURIComponent(currentName)}?/update`,
		qualityDefinitionsFields(input, 'sonarr'),
		{ headers: { Origin: ctx.origin } }
	);
}

export async function submitRemoveSonarrQualityDefinitions(
	ctx: PcdTestContext,
	currentName: string,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return ctx.client.postForm(
		`/media-management/${ctx.dbId}/quality-definitions/sonarr/${encodeURIComponent(currentName)}?/delete`,
		{ layer },
		{ headers: { Origin: ctx.origin } }
	);
}

function qualityDefinitionsFields(
	input: QualityDefinitionsFormInput,
	arrType: 'radarr' | 'sonarr'
): Record<string, string> {
	return {
		arrType,
		name: input.name,
		entries: JSON.stringify(input.entries),
		layer: input.layer ?? 'user'
	};
}

function assertSuccessfulAction(response: Response, action: string): Response {
	assert(
		response.status >= 200 && response.status < 400,
		`Expected ${action} action to return 2xx/3xx, got ${response.status}`
	);
	return response;
}
