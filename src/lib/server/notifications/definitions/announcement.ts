/**
 * Announcement notification definitions
 */

import type { AnnouncementRecord } from '$announcements/profilarr/types.ts';
import type { Notification, NotificationBlock, NotificationSeverity } from '../types.ts';

export interface NewAnnouncementParams {
	announcement: AnnouncementRecord;
}

const SEVERITY_MAP: Record<AnnouncementRecord['severity'], NotificationSeverity> = {
	info: 'info',
	warning: 'warning',
	critical: 'error'
};

/**
 * Fired by the `announcements.fetch` job whenever the reconciler inserts a
 * new (never-seen-before) announcement id. Reappearing previously-withdrawn
 * announcements do NOT fire this — the user has already been notified.
 */
export function announcementNew(params: NewAnnouncementParams): Notification {
	const { announcement } = params;

	const blocks: NotificationBlock[] = [
		{ kind: 'field', label: 'Severity', value: announcement.severity, inline: true },
		{ kind: 'field', label: 'Published', value: announcement.publishedAt, inline: true }
	];

	if (announcement.link) {
		blocks.push({
			kind: 'field',
			label: 'Link',
			value: announcement.link,
			inline: false
		});
	}

	return {
		type: 'announcement.new',
		severity: SEVERITY_MAP[announcement.severity],
		title: announcement.title,
		message: 'A new announcement from the Profilarr team.',
		blocks
	};
}
