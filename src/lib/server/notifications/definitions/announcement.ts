/**
 * Announcement notification definitions.
 *
 * One `announcement.new` type covers both bulletin (Profilarr-team) and
 * per-PCD announcements. The `source` parameter distinguishes them; PCD
 * announcements get the database name folded into the title and a `From`
 * field block so users immediately see which database posted it.
 */

import type { AnnouncementSeverity } from '$announcements/shared/types.ts';
import type { Notification, NotificationBlock, NotificationSeverity } from '../types.ts';

/**
 * Minimum shape the definition needs from any announcement record.
 * Both `AnnouncementRecord` (bulletin) and `DatabaseAnnouncementRecord`
 * (per-PCD) satisfy this structurally.
 */
export interface NotifiableAnnouncement {
	title: string;
	severity: AnnouncementSeverity;
	publishedAt: string;
	link: string | null;
}

export type AnnouncementSource = { kind: 'profilarr' } | { kind: 'pcd'; databaseName: string };

export interface NewAnnouncementParams {
	announcement: NotifiableAnnouncement;
	/** Defaults to bulletin (`{ kind: 'profilarr' }`) when omitted. */
	source?: AnnouncementSource;
}

const SEVERITY_MAP: Record<AnnouncementSeverity, NotificationSeverity> = {
	info: 'info',
	warning: 'warning',
	critical: 'error'
};

/**
 * Fired whenever a reconciler inserts a new (never-seen-before)
 * announcement id. Reappearing previously-withdrawn announcements do NOT
 * fire this — the user has already been notified.
 */
export function announcementNew(params: NewAnnouncementParams): Notification {
	const { announcement } = params;
	const source: AnnouncementSource = params.source ?? { kind: 'profilarr' };

	const blocks: NotificationBlock[] = [
		{ kind: 'field', label: 'Severity', value: announcement.severity, inline: true },
		{ kind: 'field', label: 'Published', value: announcement.publishedAt, inline: true }
	];

	if (source.kind === 'pcd') {
		blocks.push({
			kind: 'field',
			label: 'From',
			value: source.databaseName,
			inline: false
		});
	}

	if (announcement.link) {
		blocks.push({
			kind: 'field',
			label: 'Link',
			value: announcement.link,
			inline: false
		});
	}

	const title =
		source.kind === 'pcd' ? `${source.databaseName}: ${announcement.title}` : announcement.title;

	const message =
		source.kind === 'pcd'
			? `A new announcement from ${source.databaseName}.`
			: 'A new announcement from the Profilarr team.';

	return {
		type: 'announcement.new',
		severity: SEVERITY_MAP[announcement.severity],
		title,
		message,
		blocks
	};
}
