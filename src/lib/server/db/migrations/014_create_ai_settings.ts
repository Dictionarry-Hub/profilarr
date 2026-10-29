import type { Migration } from '#db/migrations.ts';

/**
 * Migration 014: Create ai_settings table
 *
 * Creates a table to store AI configuration settings.
 * Uses a singleton pattern (single row with id=1).
 *
 * Settings:
 * - enabled: Master switch for AI features
 * - api_url: OpenAI-compatible API endpoint
 * - api_key: API key for authentication (encrypted/obfuscated in storage)
 * - model: Model name to use for generation
 */

export const migration: Migration = {
	version: 14,
	name: 'Create ai_settings table',

	up: `
		CREATE TABLE ai_settings (
			id INTEGER PRIMARY KEY CHECK (id = 1),

			-- AI Configuration
			enabled INTEGER NOT NULL DEFAULT 0,
			api_url TEXT NOT NULL DEFAULT 'https://api.openai.com/v1',
			api_key TEXT NOT NULL DEFAULT '',
			model TEXT NOT NULL DEFAULT 'gpt-4o-mini',

			-- Metadata
			created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
			updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
		);

		-- Insert default settings
		INSERT INTO ai_settings (id) VALUES (1);
	`,

	down: `
		DROP TABLE IF EXISTS ai_settings;
	`
};
