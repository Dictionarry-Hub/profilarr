/**
 * Integration tests: Backup download sanitization
 *
 * Local on-disk backup archives are full-fidelity (secrets included). The
 * filesystem is the documented trust boundary, so an archive sitting next
 * to the live database does not need stripping. The download endpoint
 * (GET /api/v1/backups/{filename}) sanitizes on the fly before streaming
 * the response, so any backup that leaves the host has secrets removed.
 *
 * Sanitize policy (see src/lib/server/utils/backup/sanitize.ts):
 * - DELETE arr_instances (cascades through arr-side sync, drift, rename,
 *   cleanup, upgrade tables)
 * - DELETE notification_services (cascades to history)
 * - DELETE users, sessions, login_attempts
 * - NULL database_instances.personal_access_token (rows preserved)
 * - Strip credentials from cloned repository .git/config remote URLs
 * - Empty ai_settings.api_key, tmdb_settings.api_key
 * - auth_settings.api_key intentionally untouched (bcrypt hash of a
 *   high-entropy random key, computationally safe to share)
 *
 * The test seeds known secrets, creates a backup via the v1 API, downloads
 * it, and inspects the downloaded copy. It also verifies the on-disk
 * archive is bytewise unchanged by the download.
 */

import { assert, assertEquals, assertNotEquals } from '@std/assert';
import { TestClient } from '$test-harness/client.ts';
import { startServer, stopServer, getDbPath } from '$test-harness/server.ts';
import { createUserDirect, login } from '$test-harness/setup.ts';
import { setup, teardown, test, run } from '$test-harness/runner.ts';
import { PORTS } from '$test-harness/ports.ts';
import { openDb } from '$test-harness/db.ts';
import { hash } from '@felix/bcrypt';

const PORT = PORTS.backups.backupSecrets;
const ORIGIN = `http://localhost:${PORT}`;
const BACKUPS_DIR = `./dist/integration-${PORT}/backups`;

// Known secrets seeded into the live DB
const ARR_API_KEY = 'sonarr-backup-test-key-abc123';
const DB_PAT = 'ghp-backup-test-pat-xyz789';
const GIT_REMOTE_PAT = 'ghp-backup-test-git-remote-pat-uvw123';
const DEP_GIT_REMOTE_PAT = 'ghp-backup-test-dep-git-remote-pat-mno345';
const TMDB_API_KEY = 'tmdb-backup-test-key-def456';
const AI_API_KEY = 'sk-backup-test-ai-key-ghi012';
const PROFILARR_API_KEY = 'profilarr-backup-test-key-jkl345';
const WEBHOOK_URL = 'https://discord.com/api/webhooks/backup-test-id/backup-test-token';

let backupDbPath: string;
let infoPath: string;
let extractDir: string;
let onDiskBytesBefore: Uint8Array;
let onDiskBytesAfter: Uint8Array;
let liveProfilarrApiKeyHash: string;
let databaseUuid: string;

async function seedSecrets(dbPath: string) {
	const db = openDb(dbPath);
	try {
		// Arr instance
		db.exec(
			`INSERT INTO arr_instances (name, type, url, api_key, enabled)
			 VALUES ('Backup Test Sonarr', 'sonarr', 'http://localhost:8989', ?, 1)`,
			[ARR_API_KEY]
		);

		// Database instance
		const uuid = crypto.randomUUID();
		databaseUuid = uuid;
		db.exec(
			`INSERT INTO database_instances (uuid, name, repository_url, personal_access_token, local_path, enabled)
			 VALUES (?, 'Backup Test DB', 'https://github.com/test/repo', ?, ?, 1)`,
			[uuid, DB_PAT, `./data/databases/${uuid}`]
		);

		const repoPath = `./dist/integration-${PORT}/data/databases/${uuid}`;
		await Deno.mkdir(`${repoPath}/.git`, { recursive: true });
		await Deno.writeTextFile(
			`${repoPath}/.git/config`,
			`[core]
\trepositoryformatversion = 0
\tfilemode = true
[remote "origin"]
\turl = https://${GIT_REMOTE_PAT}@github.com/test/repo.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
`
		);
		await Deno.mkdir(`${repoPath}/deps/schema/.git`, { recursive: true });
		await Deno.writeTextFile(
			`${repoPath}/deps/schema/.git/config`,
			`[core]
\trepositoryformatversion = 0
\tfilemode = true
[remote "origin"]
\turl = https://x-access-token:${DEP_GIT_REMOTE_PAT}@github.com/test/schema.git
\tfetch = +refs/heads/*:refs/remotes/origin/*
`
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

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false;
	for (let i = 0; i < a.length; i++) {
		if (a[i] !== b[i]) return false;
	}
	return true;
}

/**
 * Trigger backup via the v1 API, poll the job until complete, capture the
 * on-disk bytes, download (which sanitizes on the fly), capture the on-disk
 * bytes again to verify they're unchanged, then extract the downloaded copy.
 */
async function downloadAndExtractBackup(
	client: TestClient
): Promise<{ dbPath: string; infoPath: string }> {
	const createRes = await client.post('/api/v1/backups', {});
	assertEquals(createRes.status, 202, 'Backup creation should return 202');
	const { jobId } = await createRes.json();

	for (let i = 0; i < 30; i++) {
		await new Promise((r) => setTimeout(r, 1000));
		const jobRes = await client.get(`/api/v1/jobs/${jobId}`);
		const job = await jobRes.json();
		if (job.status === 'success') break;
		if (job.status === 'failure') throw new Error(`Backup job failed: ${job.result?.error}`);
	}

	const listRes = await client.get('/api/v1/backups');
	assertEquals(listRes.status, 200, 'Backup list should return 200');
	const backups = await listRes.json();
	if (backups.length === 0) {
		throw new Error('No backup files found after job completed');
	}
	const backupFilename = backups[0].filename;
	const onDiskArchivePath = `${BACKUPS_DIR}/${backupFilename}`;

	// Capture bytes BEFORE download.
	onDiskBytesBefore = await Deno.readFile(onDiskArchivePath);

	// Download triggers sanitize-on-egress.
	const res = await client.get(`/api/v1/backups/${backupFilename}`);
	assertEquals(res.status, 200, 'Backup download should return 200');

	// Capture bytes AFTER download. Should match exactly: the on-disk source
	// is never mutated.
	onDiskBytesAfter = await Deno.readFile(onDiskArchivePath);

	const tmpDir = await Deno.makeTempDir({ prefix: 'profilarr-backup-test-' });
	const tarPath = `${tmpDir}/backup.tar.gz`;
	const data = new Uint8Array(await res.arrayBuffer());
	await Deno.writeFile(tarPath, data);

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

	const dbPath = `${extractDir}/data/profilarr.db`;
	await Deno.stat(dbPath);
	return { dbPath, infoPath: `${extractDir}/data/INFO.json` };
}

setup(async () => {
	await startServer(PORT, { AUTH: 'on', ORIGIN }, 'preview');
	await createUserDirect(getDbPath(PORT), 'admin', 'password123');
	await seedSecrets(getDbPath(PORT));

	// Capture the live bcrypt hash so we can later assert it survives the
	// sanitize unchanged.
	const live = openDb(getDbPath(PORT));
	try {
		const row = live.prepare('SELECT api_key FROM auth_settings WHERE id = 1').get() as {
			api_key: string;
		};
		liveProfilarrApiKeyHash = row.api_key;
	} finally {
		live.close();
	}

	const client = new TestClient(ORIGIN);
	await login(client, 'admin', 'password123', ORIGIN);
	const paths = await downloadAndExtractBackup(client);
	backupDbPath = paths.dbPath;
	infoPath = paths.infoPath;
});

teardown(async () => {
	await stopServer(PORT);
	if (extractDir) {
		try {
			const tmpDir = extractDir.replace('/extracted', '');
			await Deno.remove(tmpDir, { recursive: true });
		} catch {
			// best effort
		}
	}
});

// ─── Row deletion ────────────────────────────────────────────────────────────

test('downloaded archive: arr_instances rows are deleted', () => {
	const db = openDb(backupDbPath);
	try {
		const row = db.prepare('SELECT COUNT(*) as count FROM arr_instances').get() as {
			count: number;
		};
		assertEquals(row.count, 0, 'arr_instances should be empty in downloaded archive');
	} finally {
		db.close();
	}
});

test('downloaded archive: notification_services rows are deleted', () => {
	const db = openDb(backupDbPath);
	try {
		const row = db.prepare('SELECT COUNT(*) as count FROM notification_services').get() as {
			count: number;
		};
		assertEquals(row.count, 0, 'notification_services should be empty in downloaded archive');
	} finally {
		db.close();
	}
});

test('downloaded archive: users are deleted', () => {
	const db = openDb(backupDbPath);
	try {
		const rows = db.prepare('SELECT * FROM users').all();
		assertEquals(rows.length, 0);
	} finally {
		db.close();
	}
});

test('downloaded archive: sessions are deleted', () => {
	const db = openDb(backupDbPath);
	try {
		const rows = db.prepare('SELECT * FROM sessions').all();
		assertEquals(rows.length, 0);
	} finally {
		db.close();
	}
});

test('downloaded archive: login_attempts are deleted', () => {
	const db = openDb(backupDbPath);
	try {
		const rows = db.prepare('SELECT * FROM login_attempts').all();
		assertEquals(rows.length, 0);
	} finally {
		db.close();
	}
});

// ─── Field blanking ──────────────────────────────────────────────────────────

test('downloaded archive: database_instances rows preserved with PAT nulled', () => {
	const db = openDb(backupDbPath);
	try {
		const rows = db.prepare('SELECT personal_access_token FROM database_instances').all() as {
			personal_access_token: string | null;
		}[];
		assert(
			rows.length > 0,
			'database_instances rows should be preserved (PCD repos remain linked)'
		);
		for (const row of rows) {
			assertEquals(row.personal_access_token, null, 'PAT should be NULL in downloaded archive');
		}
	} finally {
		db.close();
	}
});

test('downloaded archive: cloned repository git remotes have credentials stripped', async () => {
	const repoConfig = await Deno.readTextFile(
		`${extractDir}/data/databases/${databaseUuid}/.git/config`
	);
	const depConfig = await Deno.readTextFile(
		`${extractDir}/data/databases/${databaseUuid}/deps/schema/.git/config`
	);

	assertEquals(
		repoConfig.includes(GIT_REMOTE_PAT),
		false,
		'Repository remote PAT should be removed from .git/config'
	);
	assertEquals(
		depConfig.includes(DEP_GIT_REMOTE_PAT),
		false,
		'Dependency remote PAT should be removed from .git/config'
	);
	assertEquals(repoConfig.includes('url = https://github.com/test/repo.git'), true);
	assertEquals(depConfig.includes('url = https://github.com/test/schema.git'), true);
});

test('downloaded archive: AI api_key is blanked', () => {
	const db = openDb(backupDbPath);
	try {
		const row = db.prepare('SELECT api_key FROM ai_settings WHERE id = 1').get() as
			| { api_key: string }
			| undefined;
		if (row) {
			assertNotEquals(row.api_key, AI_API_KEY, 'AI api_key plaintext should be removed');
		}
	} finally {
		db.close();
	}
});

test('downloaded archive: TMDB api_key is blanked', () => {
	const db = openDb(backupDbPath);
	try {
		const row = db.prepare('SELECT api_key FROM tmdb_settings WHERE id = 1').get() as {
			api_key: string;
		};
		assertNotEquals(row.api_key, TMDB_API_KEY, 'TMDB api_key plaintext should be removed');
	} finally {
		db.close();
	}
});

// ─── Intentionally preserved ─────────────────────────────────────────────────

test('downloaded archive: auth_settings.api_key bcrypt hash is preserved', () => {
	const db = openDb(backupDbPath);
	try {
		const row = db.prepare('SELECT api_key FROM auth_settings WHERE id = 1').get() as {
			api_key: string | null;
		};
		assert(row.api_key !== null, 'auth_settings.api_key should retain its bcrypt hash');
		assertEquals(
			row.api_key,
			liveProfilarrApiKeyHash,
			'hash in archive should match the live DB value'
		);
		assertNotEquals(
			row.api_key,
			PROFILARR_API_KEY,
			'hash should never equal plaintext (sanity check)'
		);
	} finally {
		db.close();
	}
});

// ─── INFO.json + on-disk integrity ───────────────────────────────────────────

test('downloaded archive: INFO.json has sanitized=true', async () => {
	const raw = await Deno.readTextFile(infoPath);
	const info = JSON.parse(raw) as { sanitized?: boolean };
	assertEquals(info.sanitized, true, 'INFO.json.sanitized should be flipped to true on download');
});

test('local on-disk archive is bytewise unchanged after download', () => {
	assertEquals(
		bytesEqual(onDiskBytesBefore, onDiskBytesAfter),
		true,
		'Download must not modify the source archive on disk'
	);
});

await run();
