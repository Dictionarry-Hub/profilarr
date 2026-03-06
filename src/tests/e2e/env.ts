import path from 'path';
import { readFileSync } from 'fs';

// Load .env file from project root if it exists
const envPath = path.resolve('.env');
try {
	const content = readFileSync(envPath, 'utf-8');
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const eqIndex = trimmed.indexOf('=');
		if (eqIndex === -1) continue;
		const key = trimmed.slice(0, eqIndex).trim();
		const value = trimmed
			.slice(eqIndex + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
		if (!process.env[key]) {
			process.env[key] = value;
		}
	}
} catch {
	// No .env file — that's fine, use env vars directly
}

/** Base URL of the running Profilarr dev server */
export const BASE_URL = process.env.BASE_URL || 'http://localhost:6969';

/** Path to the main Profilarr SQLite database */
export const DB_PATH = path.resolve(process.env.DB_PATH || 'dist/dev/data/profilarr.db');

/** Git repo URL used for both local and dev database instances */
export const TEST_REPO_URL =
	process.env.TEST_REPO_URL || 'https://github.com/Dictionarry-Hub/database-v2-testing';

/** Personal access token for the dev (write) database */
export const TEST_PAT = process.env.TEST_PAT || '';

/** Git author name for the dev database */
export const TEST_GIT_NAME = process.env.TEST_GIT_NAME || 'Test User';

/** Git author email for the dev database */
export const TEST_GIT_EMAIL = process.env.TEST_GIT_EMAIL || 'test@example.com';
