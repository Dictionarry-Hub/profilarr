/**
 * Public façade for the per-database (PCD) announcements subsystem.
 */

export {
	DATABASE_ANNOUNCEMENTS_CAP,
	getDetail,
	markRead,
	markUnread,
	reconcileAndNotify,
	reconcileFromWorkingCopy,
	type DatabaseReconcileReport
} from './service.ts';

export {
	rowToRecord,
	type AnnouncementSeverity,
	type DatabaseAnnouncementFrontmatter,
	type DatabaseAnnouncementParsed,
	type DatabaseAnnouncementRecord,
	type DatabaseAnnouncementRow
} from './types.ts';

export {
	parseAnnouncementFile,
	parseAnnouncementsDir,
	type ParseError,
	type ParseResult
} from './parser.ts';

export {
	deleteAnnouncement,
	generateAnnouncementId,
	writeAnnouncement,
	type AnnouncementFileInput
} from './authoring.ts';
