import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { onboardingQueries } from '$db/queries/onboarding.ts';

/**
 * POST /api/v1/cutscene
 *
 * Mark onboarding as shown (first-run prompt dismissed or tour completed).
 */
export const POST: RequestHandler = async () => {
	onboardingQueries.markShown();
	return json({ ok: true });
};
