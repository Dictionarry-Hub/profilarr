import { assert } from '@std/assert';
import type { OpOrigin, PcdTestContext } from './pcd.ts';

export interface RegexFormInput {
	name: string;
	pattern: string;
	description?: string | null;
	tags?: string[];
	regex101Id?: string | null;
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

export interface RadarrNamingFormInput {
	name: string;
	rename?: boolean;
	movieFormat?: string;
	movieFolderFormat?: string;
	replaceIllegalCharacters?: boolean;
	colonReplacementFormat?: RadarrColonFormat;
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
	}
};

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
		movieFormat: input.movieFormat ?? '',
		movieFolderFormat: input.movieFolderFormat ?? '',
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
		standardEpisodeFormat: input.standardEpisodeFormat ?? '',
		dailyEpisodeFormat: input.dailyEpisodeFormat ?? '',
		animeEpisodeFormat: input.animeEpisodeFormat ?? '',
		seriesFolderFormat: input.seriesFolderFormat ?? '',
		seasonFolderFormat: input.seasonFolderFormat ?? '',
		replaceIllegalCharacters: String(input.replaceIllegalCharacters ?? false),
		colonReplacementFormat: input.colonReplacementFormat ?? 'delete',
		customColonReplacementFormat: input.customColonReplacementFormat ?? '',
		multiEpisodeStyle: input.multiEpisodeStyle ?? 'extend',
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
