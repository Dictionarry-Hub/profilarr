/**
 * Integration tests: Backup secret stripping
 *
 * When a user downloads a backup, the included profilarr.db should NOT
 * contain any secrets. This prevents credential leakage if a backup
 * file is shared, stored insecurely, or downloaded by a compromised session.
 *
 * The test seeds known secrets into the live database, triggers a backup,
 * downloads it, extracts the tar.gz, and inspects the database copy inside.
 *
 * Secrets that must be stripped:
 * - arr_instances.api_key (Radarr/Sonarr API keys)
 * - database_instances.personal_access_token (GitHub PATs)
 * - auth_settings.api_key (bcrypt-hashed Profilarr API key)
 * - ai_settings.api_key (OpenAI/Anthropic keys)
 * - tmdb_settings.api_key (TMDB key)
 * - notification_services.config (JSON with webhook URLs)
 * - users (password hashes)
 * - sessions (active session tokens)
 * - login_attempts (IP addresses)
 *
 * Tests:
 * 1. Backup DB does not contain arr API keys
 * 2. Backup DB does not contain database PATs
 * 3. Backup DB does not contain Profilarr API key
 * 4. Backup DB does not contain AI API key
 * 5. Backup DB does not contain TMDB API key
 * 6. Backup DB does not contain notification webhook URLs
 * 7. Backup DB does not contain user password hashes
 * 8. Backup DB does not contain sessions
 * 9. Backup DB does not contain login attempts
 */

import { assertEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, login } from '../harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { Database } from 'jsr:@db/sqlite@0.12';
import { hash } from '@felix/bcrypt';

const PORT = 7017;
const ORIGIN = `http://localhost:${PORT}`;

// Known secrets seeded into the live DB
const ARR_API_KEY = 'sonarr-backup-test-key-abc123';
const DB_PAT = 'ghp-backup-test-pat-xyz789';
const TMDB_API_KEY = 'tmdb-backup-test-key-def456';
const AI_API_KEY = 'sk-backup-test-ai-key-ghi012';
const PROFILARR_API_KEY = 'profilarr-backup-test-key-jkl345';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/backup-test-id/backup-test-token';

let backupDbPath: string;
let extractDir: string;

async function seedSecrets(dbPath: string) {
	const db = new Database(dbPath);
	try {
		// Arr instance
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Backup Test Sonarr', 'sonarr', 'http://localhost:8989', ?, 1)`,
			[ARR_API_KEY]
		);

		// Database instance
		const uuid = crypto.randomUUID();
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, personal_access_token, local_path, enabled)
			 VALUES (?, 'Backup Test DB', 'https://github.com/test/repo', ?, ?, 1)`,
			[uuid, DB_PAT, `./data/databases/${uuid}`]
		);

		// TMDB API key
		db.exec('UPDATE tmdb_settings SET api_key = ? WHERE id = 1', [TMDB_API_KEY]);

		// AI API key
		const aiRow = db.prepare('SELECT COUNT(*) as count FROM ai_settings').get() as {
			count: number;
		};
		if (aiRow.count > 0) {
			db.exec('UPDATE ai_settings SET api_key = ? WHERE id = 1', [AI_API_KEY]);
		}

		// Profilarr API key (bcrypt-hashed)
		const hashedApiKey = await hash(PROFILARR_API_KEY);
		db.exec('UPDATE auth_settings SET api_key = ? WHERE id = 1', [hashedApiKey]);

		// Notification service with webhook URL
		const serviceId = crypto.randomUUID();
		db.exec(
			`INSERT INTO notification_services (id, name, service_type, enabled, config, enabled_types)
			 VALUES (?, 'Backup Test Discord', 'discord', 1, ?, '[]')`,
			[serviceId, JSON.stringify({ webhook_url: WEBHOOK_URL, username: 'Profilarr' })]
		);

		// Login attempt (contains IP addresses)
		db.exec(
			`INSERT INTO login_attempts (ip, endpoint, category) VALUES ('192.168.1.100', '/auth/login', 'unknown')`
		);
	} finally {
		db.close();
	}
}

/**
 * Trigger backup, poll until a backup file appears, download and extract it.
 * Returns the path to the extracted profilarr.db.
 */
async function downloadAndExtractBackup(client: TestClient): Promise<string> {
	// Trigger backup creation
	await client.postForm('/settings/backups?/createBackup', {}, { headers: { Origin: ORIGIN } });

	// Poll until a backup file appears (job queue processes it async)
	let backupFilename = '';
	for (let i = 0; i < 30; i++) {
		await new Promise((r) => setTimeout(r, 1000));

		const basePath = `./dist/integration-${PORT}/backups`;
		try {
			for await (const entry of Deno.readDir(basePath)) {
				if (entry.name.startsWith('backup-') && entry.name.endsWith('.tar.gz')) {
					backupFilename = entry.name;
					break;
				}
			}
		} catch {
			// Directory may not exist yet
		}
		if (backupFilename) break;
	}

	if (!backupFilename) {
		throw new Error('Backup file did not appear within 30 seconds');
	}

	// Download the backup
	const res = await client.get(`/api/backups/download/${backupFilename}`);
	assertEquals(res.status, 200, 'Backup download should return 200');

	// Write to a temp file
	const tmpDir = await Deno.makeTempDir({ prefix: 'profilarr-backup-test-' });
	const tarPath = `${tmpDir}/backup.tar.gz`;
	const data = new Uint8Array(await res.arrayBuffer());
	await Deno.writeFile(tarPath, data);

	// Extract
	extractDir = `${tmpDir}/extracted`;
	await Deno.mkdir(extractDir, { recursive: true });
	const extract = new Deno.Command('tar', {
		args: ['-xzf', tarPath, '-C', extractDir],
		stdout: 'piped',
		stderr: 'piped'
	});
	const { code } = await extract.output();
	if (code !== 0) {
		throw new Error('Failed to extract backup tar.gz');
	}

	// Find profilarr.db in extracted contents
	const dbPath = `${extractDir}/data/profilarr.db`;
	await Deno.stat(dbPath);
	return dbPath;
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
	await seedSecrets(getDbPath(PORT));

	// Login and download the backup once — all tests inspect the same extracted DB
	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	backupDbPath = await downloadAndExtractBackup(client);
});

teardown(async () => {
	await stopServer(PORT);
	if (extractDir) {
		try {
			// extractDir is inside a temp dir — remove the parent
			const tmpDir = extractDir.replace('/extracted', '');
			await Deno.remove(tmpDir, { recursive: true });
		} catch {
			// Cleanup is best-effort
		}
	}
});

test('backup DB does not contain arr API keys', () => {
	const db = new Database(backupDbPath);
	try {
		const rows = db.prepare('SELECT api_key FROM arr_instances').all() as { api_key: string }[];
		for (const row of rows) {
			assertEquals(row.api_key === ARR_API_KEY, false, 'Backup DB contains plaintext arr API key');
		}
	} finally {
		db.close();
	}
});

test('backup DB does not contain database PATs', () => {
	const db = new Database(backupDbPath);
	try {
		const rows = db.prepare('SELECT personal_access_token FROM database_instances').all() as {
			personal_access_token: string | null;
		}[];
		for (const row of rows) {
			assertEquals(
				row.personal_access_token === DB_PAT,
				false,
				'Backup DB contains plaintext database PAT'
			);
		}
	} finally {
		db.close();
	}
});

test('backup DB does not contain Profilarr API key', () => {
	const db = new Database(backupDbPath);
	try {
		const row = db.prepare('SELECT api_key FROM auth_settings WHERE id = 1').get() as {
			api_key: string | null;
		};
		assertEquals(row.api_key, null, 'Backup DB contains Profilarr API key hash');
	} finally {
		db.close();
	}
});

test('backup DB does not contain AI API key', () => {
	const db = new Database(backupDbPath);
	try {
		const row = db.prepare('SELECT api_key FROM ai_settings WHERE id = 1').get() as
			| {
					api_key: string | null;
			  }
			| undefined;
		if (row) {
			assertEquals(row.api_key === AI_API_KEY, false, 'Backup DB contains plaintext AI API key');
		}
	} finally {
		db.close();
	}
});

test('backup DB does not contain TMDB API key', () => {
	const db = new Database(backupDbPath);
	try {
		const row = db.prepare('SELECT api_key FROM tmdb_settings WHERE id = 1').get() as {
			api_key: string;
		};
		assertEquals(row.api_key === TMDB_API_KEY, false, 'Backup DB contains plaintext TMDB API key');
	} finally {
		db.close();
	}
});

test('backup DB does not contain notification webhook URLs', () => {
	const db = new Database(backupDbPath);
	try {
		const rows = db.prepare('SELECT config FROM notification_services').all() as {
			config: string;
		}[];
		for (const row of rows) {
			assertEquals(
				row.config.includes(WEBHOOK_URL),
				false,
				'Backup DB contains webhook URL in notification config'
			);
		}
	} finally {
		db.close();
	}
});

test('backup DB does not contain user password hashes', () => {
	const db = new Database(backupDbPath);
	try {
		const rows = db.prepare('SELECT * FROM users').all();
		assertEquals(rows.length, 0, 'Backup DB still contains user records');
	} finally {
		db.close();
	}
});

test('backup DB does not contain sessions', () => {
	const db = new Database(backupDbPath);
	try {
		const rows = db.prepare('SELECT * FROM sessions').all();
		assertEquals(rows.length, 0, 'Backup DB still contains session records');
	} finally {
		db.close();
	}
});

test('backup DB does not contain login attempts', () => {
	const db = new Database(backupDbPath);
	try {
		const rows = db.prepare('SELECT * FROM login_attempts').all();
		assertEquals(rows.length, 0, 'Backup DB still contains login attempt records');
	} finally {
		db.close();
	}
});

await run();
