/**
 * Boot-time restore application.
 *
 * The restore form action stages a pending restore by writing a sentinel
 * file at `${base}/.restore-pending` containing the absolute path of the
 * archive to apply. This module's `applyPendingRestore()` runs early in
 * the boot sequence, after `config.init()` (so directories exist) but
 * before `db.initialize()` (so no SQLite handle is open), and applies
 * the staged archive in-place.
 *
 * Why boot-time, not in-process: SQLite holds memory-mapped state for
 * `-wal`/`-shm` while the DB is open. Overwriting `profilarr.db` mid-flight
 * leaves the running process reading inconsistent pages. Doing the swap
 * during the boot window where no connection exists is the only correct
 * pattern (matches Sonarr's `DatabaseRestorationService`).
 *
 * Failure model: extraction crashes leave the live `data/` untouched
 * because we extract into a separate `.restoring/` staging dir before any
 * destructive step. Crashes after the wipe but before the swap leave the
 * sentinel in place so the next boot retries cleanly. Unexpected errors
 * are logged loudly and rethrown so boot fails fast rather than continuing
 * into `db.initialize()` against a broken `data/`.
 */

import { config } from '$config';
import { logger } from '$logger/logger.ts';

const SENTINEL_NAME = '.restore-pending';
const STAGING_NAME = '.restoring';

interface ArchiveInfo {
	appVersion?: string;
	appChannel?: string;
	schemaVersion?: number | null;
	createdAt?: string;
	sanitized?: boolean;
}

async function removeIfExists(path: string, opts?: { recursive?: boolean }): Promise<void> {
	try {
		await Deno.remove(path, opts);
	} catch (err) {
		if (!(err instanceof Deno.errors.NotFound)) throw err;
	}
}

async function readArchiveInfo(stagingDataDir: string): Promise<ArchiveInfo> {
	try {
		const raw = await Deno.readTextFile(`${stagingDataDir}/INFO.json`);
		return JSON.parse(raw) as ArchiveInfo;
	} catch {
		// Older archives don't have INFO.json. Not fatal.
		return {};
	}
}

export async function applyPendingRestore(): Promise<void> {
	const sentinelPath = `${config.paths.base}/${SENTINEL_NAME}`;
	const stagingPath = `${config.paths.base}/${STAGING_NAME}`;
	const dataDir = config.paths.data;

	let archivePath: string;
	try {
		archivePath = (await Deno.readTextFile(sentinelPath)).trim();
	} catch (err) {
		if (err instanceof Deno.errors.NotFound) return;
		throw err;
	}

	await logger.info('Pending restore detected', {
		source: 'applyPendingRestore',
		meta: { archivePath }
	});

	// Verify archive still exists. If it's gone, drop the sentinel and
	// continue boot with the existing data, destroying nothing.
	try {
		await Deno.stat(archivePath);
	} catch {
		await logger.error('Pending restore archive missing; aborting and clearing sentinel', {
			source: 'applyPendingRestore',
			meta: { archivePath }
		});
		await removeIfExists(sentinelPath);
		return;
	}

	// Wipe any leftover staging dir from a previously crashed apply.
	await removeIfExists(stagingPath, { recursive: true });
	await Deno.mkdir(stagingPath, { recursive: true });

	// Extract into the staging dir. Live `data/` untouched at this point.
	const tar = new Deno.Command('tar', {
		args: ['-xzf', archivePath, '-C', stagingPath],
		stdout: 'piped',
		stderr: 'piped'
	});
	const tarResult = await tar.output();
	if (tarResult.code !== 0) {
		const stderr = new TextDecoder().decode(tarResult.stderr).trim();
		await logger.error('Pending restore extraction failed; live data left untouched', {
			source: 'applyPendingRestore',
			meta: { archivePath, stderr, exitCode: tarResult.code }
		});
		await removeIfExists(stagingPath, { recursive: true });
		// Leave the sentinel in place: the operator may want to fix the
		// archive and retry. Failing fast prevents boot against unknown state.
		throw new Error(`Restore extraction failed (exit ${tarResult.code}): ${stderr}`);
	}

	const stagingDataDir = `${stagingPath}/data`;

	// Sanity-check the archive shape before destroying anything.
	try {
		const stat = await Deno.stat(`${stagingDataDir}/profilarr.db`);
		if (!stat.isFile) throw new Error('profilarr.db is not a file');
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		await logger.error('Staged archive missing profilarr.db; aborting', {
			source: 'applyPendingRestore',
			meta: { archivePath, error: message }
		});
		await removeIfExists(stagingPath, { recursive: true });
		throw new Error(`Restore archive does not contain data/profilarr.db: ${message}`);
	}

	const info = await readArchiveInfo(stagingDataDir);
	await logger.info('Restore archive metadata', {
		source: 'applyPendingRestore',
		meta: info
	});

	// Wipe live data dir contents we own. Anything else (e.g. a file an
	// operator manually placed) is left alone.
	await removeIfExists(`${dataDir}/profilarr.db`);
	await removeIfExists(`${dataDir}/profilarr.db-wal`);
	await removeIfExists(`${dataDir}/profilarr.db-shm`);
	await removeIfExists(`${dataDir}/databases`, { recursive: true });
	await removeIfExists(`${dataDir}/INFO.json`);

	// Move staged contents into place. Per-entry rename is atomic on the
	// same filesystem (which staging and data both are, both under base).
	for await (const entry of Deno.readDir(stagingDataDir)) {
		const src = `${stagingDataDir}/${entry.name}`;
		const dst = `${dataDir}/${entry.name}`;
		await removeIfExists(dst, { recursive: true });
		await Deno.rename(src, dst);
	}

	// Cleanup. Sentinel last so a crash anywhere above leaves it in place
	// for the next boot to retry.
	await removeIfExists(stagingPath, { recursive: true });
	await Deno.remove(sentinelPath);

	await logger.info('Pending restore applied', {
		source: 'applyPendingRestore',
		meta: { archivePath, info }
	});
}
