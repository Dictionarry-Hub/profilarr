import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getDetail, listVisible, markRead, markUnread } from '$announcements/index.ts';

export const load: PageServerLoad = async () => {
	const visible = listVisible();

	// Ensure bodies are loaded (lazy-fetches from bulletin on first miss, then
	// cached in the DB). Announcement counts are small; parallel fetch is fine.
	const detailed = await Promise.all(
		visible.map(async (a) => {
			const full = (await getDetail(a.id, { loadBody: true })) ?? a;
			return {
				id: full.id,
				title: full.title,
				severity: full.severity,
				publishedAt: full.publishedAt,
				expiresAt: full.expiresAt,
				link: full.link,
				readAt: full.readAt,
				body: full.body
			};
		})
	);

	return { announcements: detailed };
};

function requireId(form: FormData): string | null {
	const id = form.get('id');
	return typeof id === 'string' && id ? id : null;
}

export const actions: Actions = {
	markRead: async ({ request }) => {
		const id = requireId(await request.formData());
		if (!id) return fail(400, { error: 'id required' });
		markRead(id);
		return { success: true };
	},
	markUnread: async ({ request }) => {
		const id = requireId(await request.formData());
		if (!id) return fail(400, { error: 'id required' });
		markUnread(id);
		return { success: true };
	}
};
