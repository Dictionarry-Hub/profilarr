import { db } from '../db.ts';
import { toUTC } from '$shared/utils/dates.ts';

/**
 * Database row type for notification_history table
 */
interface NotificationHistoryRow {
	id: number;
	service_id: string;
	notification_type: string;
	title: string;
	message: string;
	metadata: string | null;
	status: 'success' | 'failed';
	error: string | null;
	sent_at: string;
}

function rowToRecord(row: NotificationHistoryRow): NotificationHistoryRecord {
	return {
		...row,
		sent_at: toUTC(row.sent_at)!
	};
}

/**
 * Types for notification_history table
 */
export interface NotificationHistoryRecord {
	id: number;
	service_id: string;
	notification_type: string;
	title: string;
	message: string;
	metadata: string | null; // JSON string
	status: 'success' | 'failed';
	error: string | null;
	sent_at: string;
}

export interface CreateNotificationHistoryInput {
	serviceId: string;
	notificationType: string;
	title: string;
	message: string;
	metadata?: Record<string, unknown>;
	status: 'success' | 'failed';
	error?: string;
}

export interface NotificationHistoryFilters {
	serviceId?: string;
	notificationType?: string;
	status?: 'success' | 'failed';
	limit?: number;
	offset?: number;
}

/**
 * All queries for notification_history table
 */
export const notificationHistoryQueries = {
	/**
	 * Create a new notification history record
	 */
	create(input: CreateNotificationHistoryInput): boolean {
		const affected = db.execute(
			`INSERT INTO notification_history (
				service_id, notification_type, title, message, metadata, status, error
			) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			input.serviceId,
			input.notificationType,
			input.title,
			input.message,
			input.metadata ? JSON.stringify(input.metadata) : null,
			input.status,
			input.error ?? null
		);

		return affected > 0;
	},

	/**
	 * Get notification history with optional filters
	 */
	getHistory(filters?: NotificationHistoryFilters): NotificationHistoryRecord[] {
		const conditions: string[] = [];
		const params: (string | number)[] = [];

		if (filters?.serviceId) {
			conditions.push('service_id = ?');
			params.push(filters.serviceId);
		}

		if (filters?.notificationType) {
			conditions.push('notification_type = ?');
			params.push(filters.notificationType);
		}

		if (filters?.status) {
			conditions.push('status = ?');
			params.push(filters.status);
		}

		const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
		const limit = filters?.limit ?? 100;
		const offset = filters?.offset ?? 0;

		return db
			.query<NotificationHistoryRow>(
				`SELECT * FROM notification_history ${whereClause} ORDER BY sent_at DESC LIMIT ? OFFSET ?`,
				...params,
				limit,
				offset
			)
			.map(rowToRecord);
	},

	/**
	 * Get recent notification history (last 50 by default)
	 */
	getRecent(limit: number = 50): NotificationHistoryRecord[] {
		return db
			.query<NotificationHistoryRow>(
				'SELECT * FROM notification_history ORDER BY sent_at DESC LIMIT ?',
				limit
			)
			.map(rowToRecord);
	},

	/**
	 * Get notification history for a specific service
	 */
	getByServiceId(serviceId: string, limit: number = 50): NotificationHistoryRecord[] {
		return db
			.query<NotificationHistoryRow>(
				'SELECT * FROM notification_history WHERE service_id = ? ORDER BY sent_at DESC LIMIT ?',
				serviceId,
				limit
			)
			.map(rowToRecord);
	},

	/**
	 * Get notification history by type
	 */
	getByType(notificationType: string, limit: number = 50): NotificationHistoryRecord[] {
		return db
			.query<NotificationHistoryRow>(
				'SELECT * FROM notification_history WHERE notification_type = ? ORDER BY sent_at DESC LIMIT ?',
				notificationType,
				limit
			)
			.map(rowToRecord);
	},

	/**
	 * Get failed notifications
	 */
	getFailed(limit: number = 50): NotificationHistoryRecord[] {
		return db
			.query<NotificationHistoryRow>(
				"SELECT * FROM notification_history WHERE status = 'failed' ORDER BY sent_at DESC LIMIT ?",
				limit
			)
			.map(rowToRecord);
	},

	/**
	 * Get statistics for a service
	 */
	getStats(serviceId?: string): {
		total: number;
		success: number;
		failed: number;
		successRate: number;
	} {
		const whereClause = serviceId ? 'WHERE service_id = ?' : '';
		const params = serviceId ? [serviceId] : [];

		const result = db.queryFirst<{
			total: number;
			success: number;
			failed: number;
		}>(
			`SELECT
				COUNT(*) as total,
				SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as success,
				SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
			FROM notification_history ${whereClause}`,
			...params
		);

		if (!result || result.total === 0) {
			return { total: 0, success: 0, failed: 0, successRate: 0 };
		}

		return {
			total: result.total,
			success: result.success,
			failed: result.failed,
			successRate: (result.success / result.total) * 100
		};
	},

	/**
	 * Delete old notification history records
	 */
	deleteOlderThan(days: number): number {
		const affected = db.execute(
			`DELETE FROM notification_history
			WHERE sent_at < datetime('now', '-' || ? || ' days')`,
			days
		);

		return affected;
	},

	/**
	 * Delete all history for a specific service (used when service is deleted)
	 */
	deleteByServiceId(serviceId: string): number {
		const affected = db.execute('DELETE FROM notification_history WHERE service_id = ?', serviceId);

		return affected;
	}
};
