import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { validateRegex } from '$lib/server/utils/arr/parser/index.ts';

interface ValidateRegexResponse {
	valid: boolean;
	error?: string;
	available?: boolean;
}

export const POST: RequestHandler = async ({ request }) => {
	const { pattern } = (await request.json()) as { pattern?: string };

	if (!pattern?.trim()) {
		return json({ valid: false, error: 'Pattern is required' } satisfies ValidateRegexResponse);
	}

	const result = await validateRegex(pattern.trim());

	if (result === null) {
		return json({ valid: true, available: false } satisfies ValidateRegexResponse);
	}

	return json({ ...result, available: true } satisfies ValidateRegexResponse);
};
