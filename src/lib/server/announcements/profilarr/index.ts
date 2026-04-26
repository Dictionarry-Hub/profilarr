/**
 * Public façade for the bulletin (profilarr) announcements subsystem.
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
	rowToRecord,
	type AnnouncementRecord,
	type AnnouncementRow,
	type AnnouncementSeverity,
	type BulletinAnnouncement,
	type BulletinAnnouncementsFile,
	type BulletinRelease,
	type BulletinVersionsFile,
	type VersionsSnapshotRow
} from './types.ts';

export { compareVersions, isVisible, satisfiesRange, type VisibilityContext } from './filter.ts';

export { ANNOUNCEMENTS_CAP, UnsupportedSchemaError, reconcileAnnouncements } from './reconcile.ts';
