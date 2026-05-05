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

export const write = {
	regex: {
		create: createRegex,
		update: updateRegex,
		remove: removeRegex
	}
};

export async function createRegex(ctx: PcdTestContext, input: RegexFormInput): Promise<Response> {
	return assertSuccessfulAction(
		await ctx.client.postForm(
			`/regular-expressions/${ctx.dbId}/new`,
			regexFields(input),
			{ headers: { Origin: ctx.origin } }
		),
		'create regex'
	);
}

export async function updateRegex(
	ctx: PcdTestContext,
	id: number,
	input: RegexFormInput
): Promise<Response> {
	return assertSuccessfulAction(
		await ctx.client.postForm(
			`/regular-expressions/${ctx.dbId}/${id}?/update`,
			regexFields(input),
			{ headers: { Origin: ctx.origin } }
		),
		'update regex'
	);
}

export async function removeRegex(
	ctx: PcdTestContext,
	id: number,
	layer: OpOrigin = 'user'
): Promise<Response> {
	return assertSuccessfulAction(
		await ctx.client.postForm(
			`/regular-expressions/${ctx.dbId}/${id}?/delete`,
			{ layer },
			{ headers: { Origin: ctx.origin } }
		),
		'delete regex'
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

function assertSuccessfulAction(response: Response, action: string): Response {
	assert(
		response.status >= 200 && response.status < 400,
		`Expected ${action} action to return 2xx/3xx, got ${response.status}`
	);
	return response;
}
