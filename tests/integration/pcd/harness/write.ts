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

function assertSuccessfulAction(response: Response, action: string): Response {
	assert(
		response.status >= 200 && response.status < 400,
		`Expected ${action} action to return 2xx/3xx, got ${response.status}`
	);
	return response;
}
