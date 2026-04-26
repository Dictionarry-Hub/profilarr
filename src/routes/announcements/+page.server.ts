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
			databaseRepoUrl: item.databaseRepoUrl,
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
	},
	markReadMany: async ({ request }) => {
		const raw = (await request.formData()).get('targets');
		if (typeof raw !== 'string') return fail(400, { error: 'missing targets' });
		let parsed: unknown;
		try {
			parsed = JSON.parse(raw);
		} catch {
			return fail(400, { error: 'invalid targets json' });
		}
		if (!Array.isArray(parsed)) return fail(400, { error: 'targets must be an array' });

		const targets: ParsedTarget[] = [];
		for (const item of parsed) {
			if (!item || typeof item !== 'object') continue;
			const source = (item as { source?: unknown }).source;
			const id = (item as { id?: unknown }).id;
			const databaseId = (item as { databaseId?: unknown }).databaseId;
			if (source !== 'profilarr' && source !== 'pcd') continue;
			if (typeof id !== 'string' || !id) continue;
			if (source === 'profilarr') {
				targets.push({ source, id, databaseId: null });
			} else if (typeof databaseId === 'number' && Number.isFinite(databaseId)) {
				targets.push({ source, id, databaseId });
			}
		}
		inbox.markReadMany(targets);
		return { success: true, count: targets.length };
	}
};
