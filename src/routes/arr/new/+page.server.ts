import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from '@sveltejs/kit';
import { createArrInstance } from '#server/arr_instances/service.ts';

function parseTags(json: string | undefined): string[] {
	if (!json) return [];

	try {
		const parsed = JSON.parse(json);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export const actions = {
	default: async ({ request }) => {
		const formData = await request.formData();
		const text = (key: string) => formData.get(key)?.toString();

		const raw = {
			name: text('name'),
			type: text('type')?.trim(),
			url: text('url'),
			external_url: text('external_url'),
			api_key: text('api_key'),
			basic_auth_username: text('basic_auth_username'),
			basic_auth_password: text('basic_auth_password'),
			tags: parseTags(text('tags'))
		};

		const result = await createArrInstance(raw);
		if (!result.ok) {
			return fail(result.kind === 'failed' ? 500 : 400, {
				error: result.message,
				values: { name: raw.name, type: raw.type, url: raw.url }
			});
		}

		redirect(303, '/arr');
	}
} satisfies Actions;
