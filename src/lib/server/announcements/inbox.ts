/**
 * Inbox orchestrator.
 *
 * Combines bulletin (Profilarr team) and per-PCD announcement records into
 * a single normalized list for the `/announcements` page and the layout
 * unread badge. Dispatches detail / mark-read / mark-unread to the right
 * subsystem based on the `source` discriminator.
 *
 * Lazy body fetch only applies to the bulletin path; database announcement
 * bodies are snapshotted at reconcile time, so they are always present in
 * the DB row.
 */

import { databaseInstancesQueries } from '$db/queries/databaseInstances.ts';
import { databaseAnnouncementQueries } from '$db/queries/databaseAnnouncements.ts';
import { announcementQueries } from '$db/queries/announcements.ts';
import { build } from '$lib/shared/build.ts';
import { isVisibleBase } from './shared/filter.ts';
import type { AnnouncementSeverity } from './shared/types.ts';
import * as profilarr from './profilarr/index.ts';
import * as database from './database/index.ts';
import { isVisible as isVisibleProfilarr } from './profilarr/filter.ts';
import { rowToRecord as rowToProfilarrRecord } from './profilarr/types.ts';

export type InboxSource = 'profilarr' | 'pcd';

export interface InboxItem {
	source: InboxSource;
	/** Composite id with the database id when source is `pcd`. */
	id: string;
	databaseId: number | null;
	databaseName: string | null;
	databaseRepoUrl: string | null;
	title: string;
	severity: AnnouncementSeverity;
	publishedAt: string;
	expiresAt: string | null;
	link: string | null;
	body: string | null;
	readAt: string | null;
}

/**
 * Returns every visible announcement across both sources, newest first.
 * Bodies are NOT lazy-fetched here; callers that need bodies should call
 * `loadBodies(items)` afterwards or fetch on demand via `getDetail`.
 */
export function listInbox(): InboxItem[] {
	const items = [...listProfilarrItems(), ...listDatabaseItems()];
	items.sort((a, b) =>
		a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0
	);
	return items;
}

/** Combined unread count across both sources. Powers the nav badge. */
export function getUnreadCount(): number {
	return listInbox().filter((item) => item.readAt === null).length;
}

/**
 * Resolve the full record for a single inbox item. For bulletin entries,
 * lazy-fetches the body if requested. For database entries, the body is
 * already on the row.
 */
export async function getDetail(
	source: InboxSource,
	id: string,
	databaseId: number | null,
	opts: { loadBody?: boolean } = {}
): Promise<InboxItem | undefined> {
	if (source === 'profilarr') {
		const record = await profilarr.getDetail(id, opts);
		if (!record) return undefined;
		return profilarrRecordToItem(record);
	}
	if (databaseId === null) return undefined;
	const record = database.getDetail(id, databaseId);
	if (!record) return undefined;
	const instance = databaseInstancesQueries.getById(databaseId);
	return databaseRecordToItem(
		record,
		instance?.name ?? '(unknown database)',
		instance?.repository_url ?? null
	);
}

export function markRead(source: InboxSource, id: string, databaseId: number | null): void {
	if (source === 'profilarr') {
		profilarr.markRead(id);
		return;
	}
	if (databaseId === null) return;
	database.markRead(id, databaseId);
}

export function markUnread(source: InboxSource, id: string, databaseId: number | null): void {
	if (source === 'profilarr') {
		profilarr.markUnread(id);
		return;
	}
	if (databaseId === null) return;
	database.markUnread(id, databaseId);
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function listProfilarrItems(): InboxItem[] {
	const ctx = {
		now: new Date().toISOString(),
		version: build.version,
		channel: build.channel
	};
	return announcementQueries
		.listAll()
		.map(rowToProfilarrRecord)
		.filter((record) => isVisibleProfilarr(record, ctx))
		.map(profilarrRecordToItem);
}

function listDatabaseItems(): InboxItem[] {
	const now = new Date().toISOString();
	const databases = databaseInstancesQueries.getAll();
	const instanceById = new Map<number, { name: string; repoUrl: string }>(
		databases.map((d) => [d.id, { name: d.name, repoUrl: d.repository_url }])
	);

	return databaseAnnouncementQueries
		.listAll()
		.map((row) => database.rowToRecord(row))
		.filter((record) =>
			isVisibleBase({ withdrawn: record.withdrawn, expiresAt: record.expiresAt }, now)
		)
		.map((record) => {
			const instance = instanceById.get(record.databaseId);
			return databaseRecordToItem(
				record,
				instance?.name ?? '(unknown database)',
				instance?.repoUrl ?? null
			);
		});
}

function profilarrRecordToItem(record: profilarr.AnnouncementRecord): InboxItem {
	return {
		source: 'profilarr',
		id: record.id,
		databaseId: null,
		databaseName: null,
		databaseRepoUrl: null,
		title: record.title,
		severity: record.severity,
		publishedAt: record.publishedAt,
		expiresAt: record.expiresAt,
		link: record.link,
		body: record.body,
		readAt: record.readAt
	};
}

function databaseRecordToItem(
	record: database.DatabaseAnnouncementRecord,
	databaseName: string,
	databaseRepoUrl: string | null
): InboxItem {
	return {
		source: 'pcd',
		id: record.id,
		databaseId: record.databaseId,
		databaseName,
		databaseRepoUrl,
		title: record.title,
		severity: record.severity,
		publishedAt: record.publishedAt,
		expiresAt: record.expiresAt,
		link: record.link,
		body: record.body,
		readAt: record.readAt
	};
}
