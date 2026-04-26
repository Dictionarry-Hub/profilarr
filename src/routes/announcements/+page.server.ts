import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { inbox, type InboxSource } from '$announcements/index.ts';

export const load: PageServerLoad = async () => {
	const items = inbox.listInbox();

	// Lazy-load bodies for bulletin entries (the database side already
	// snapshots the body at reconcile time). Counts are small; parallel is
	// fine.
	const detailed = await Promise.all(
		items.map(async (item) => {
			if (item.source === 'profilarr' && item.body === null) {
				const full = await inbox.getDetail(item.source, item.id, item.databaseId, {
					loadBody: true
				});
				return full ?? item;
			}
			return item;
		})
	);

	return {
		announcements: detailed.map((item) => ({
			source: item.source,
			id: item.id,
			databaseId: item.databaseId,
			databaseName: item.databaseName,
			title: item.title,
			severity: item.severity,
			publishedAt: item.publishedAt,
			expiresAt: item.expiresAt,
			link: item.link,
			readAt: item.readAt,
			body: item.body
		}))
	};
};

interface ParsedTarget {
	source: InboxSource;
	id: string;
	databaseId: number | null;
}

function parseTarget(form: FormData): ParsedTarget | null {
	const id = form.get('id');
	const source = form.get('source');
	if (typeof id !== 'string' || !id) return null;
	if (source !== 'profilarr' && source !== 'pcd') return null;

	if (source === 'profilarr') {
		return { source, id, databaseId: null };
	}

	const rawDbId = form.get('databaseId');
	if (typeof rawDbId !== 'string' || !rawDbId) return null;
	const databaseId = Number(rawDbId);
	if (!Number.isFinite(databaseId)) return null;
	return { source, id, databaseId };
}

export const actions: Actions = {
	markRead: async ({ request }) => {
		const target = parseTarget(await request.formData());
		if (!target) return fail(400, { error: 'invalid target' });
		inbox.markRead(target.source, target.id, target.databaseId);
		return { success: true };
	},
	markUnread: async ({ request }) => {
		const target = parseTarget(await request.formData());
		if (!target) return fail(400, { error: 'invalid target' });
		inbox.markUnread(target.source, target.id, target.databaseId);
		return { success: true };
	}
};
