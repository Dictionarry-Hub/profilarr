/**
 * HTTP client for fetching bulletin files from the CDN.
 *
 * All three fetchers return `{ ok, data }` or `{ ok: false, error }` instead
 * of throwing, so the reconcile job can gracefully degrade: a failed
 * announcements fetch shouldn't break the versions sync (and vice versa).
 *
 * Base URL is `config.bulletinUrl`, overridable via `PROFILARR_BULLETIN_URL`.
 */

import { config } from '$config';
import { BaseHttpClient } from '$http/client.ts';
import type { BulletinAnnouncementsFile, BulletinVersionsFile } from './types.ts';

export type FetchResult<T> = { ok: true; data: T } | { ok: false; error: string };

let client: BaseHttpClient | null = null;

function getClient(): BaseHttpClient {
	if (!client) {
		client = new BaseHttpClient(config.bulletinUrl, {
			timeout: 10_000,
			retries: 2,
			retryDelay: 500,
			// The raw CDN sometimes returns 429 under load; treat as retryable.
			retryStatusCodes: [429, 500, 502, 503, 504]
		});
	}
	return client;
}

function describeError(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}

export async function fetchVersions(): Promise<FetchResult<BulletinVersionsFile>> {
	try {
		const data = await getClient().get<BulletinVersionsFile>('/versions.json');
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}

export async function fetchAnnouncements(): Promise<FetchResult<BulletinAnnouncementsFile>> {
	try {
		const data = await getClient().get<BulletinAnnouncementsFile>('/announcements.json');
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}

export async function fetchBody(id: string): Promise<FetchResult<string>> {
	try {
		const data = await getClient().get<string>(`/announcements/${id}.md`, {
			responseType: 'text'
		});
		return { ok: true, data };
	} catch (error) {
		return { ok: false, error: describeError(error) };
	}
}

/** Used by tests to reset the singleton when swapping `config.bulletinUrl`. */
export function resetBulletinClient(): void {
	client?.close();
	client = null;
}
