/**
 * Public façade for the announcements subsystem.
 *
 * Consumers (API routes, load functions, job handler) should import from
 * here rather than reaching into individual files.
 */

export {
	FETCH_INTERVAL_MS,
	getDetail,
	getUnreadCount,
	getVersionsSnapshot,
	listVisible,
	markRead,
	markUnread,
	reconcileFromBulletin,
	type ReconcileReport
} from './service.ts';

export {
	type AnnouncementRecord,
	type AnnouncementSeverity,
	type BulletinVersionsFile,
	type BulletinRelease
} from './types.ts';
