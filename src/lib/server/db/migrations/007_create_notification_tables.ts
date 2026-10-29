import type { Migration } from '#db/migrations.ts';

/**
 * Migration 007: Create notification tables
 *
 * Creates two tables:
 * - notification_services: Store notification service configurations (Discord, Slack, etc.)
 * - notification_history: Track notification delivery history for auditing
 */

export const migration: Migration = {
	version: 7,
	name: 'Create notification tables',

	up: `
		-- Create notification_services table
		CREATE TABLE notification_services (
			id TEXT PRIMARY KEY,                        -- UUID

			-- Service identification
			name TEXT NOT NULL,                         -- User-defined: "Main Discord", "Error Alerts"
			service_type TEXT NOT NULL,                 -- 'discord', 'slack', 'email', etc.

			-- Configuration
			enabled INTEGER NOT NULL DEFAULT 0,         -- Master on/off switch
			config TEXT NOT NULL,                       -- JSON blob: { webhook_url: "...", username: "...", ... }
			enabled_types TEXT NOT NULL,                -- JSON array: ["job.backup.success", "job.backup.failed"]

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Create notification_history table
		CREATE TABLE notification_history (
			id INTEGER PRIMARY KEY AUTOINCREMENT,

			-- Foreign key to notification service
			service_id TEXT NOT NULL,

			-- Notification details
			notification_type TEXT NOT NULL,            -- e.g., 'job.backup.success'
			title TEXT NOT NULL,
			message TEXT NOT NULL,
			metadata TEXT,                              -- JSON blob for additional context

			-- Delivery status
			status TEXT NOT NULL CHECK (status IN ('success', 'failed')),
			error TEXT,                                 -- Error message if status = 'failed'

			-- Timing
			sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,

			FOREIGN KEY (service_id) REFERENCES notification_services(id) ON DELETE CASCADE
		);

		-- Create indexes for notification_services
		CREATE INDEX idx_notification_services_enabled ON notification_services(enabled);
		CREATE INDEX idx_notification_services_type ON notification_services(service_type);

		-- Create indexes for notification_history
		CREATE INDEX idx_notification_history_service_id ON notification_history(service_id);
		CREATE INDEX idx_notification_history_sent_at ON notification_history(sent_at);
		CREATE INDEX idx_notification_history_status ON notification_history(status);
	`,

	down: `
		-- Drop indexes first
		DROP INDEX IF EXISTS idx_notification_history_status;
		DROP INDEX IF EXISTS idx_notification_history_sent_at;
		DROP INDEX IF EXISTS idx_notification_history_service_id;
		DROP INDEX IF EXISTS idx_notification_services_type;
		DROP INDEX IF EXISTS idx_notification_services_enabled;

		-- Drop tables
		DROP TABLE IF EXISTS notification_history;
		DROP TABLE IF EXISTS notification_services;
	`
};
