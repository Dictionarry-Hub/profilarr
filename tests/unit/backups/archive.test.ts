/**
 * Unit tests for archive validation (zip slip protection).
 */

import { assertEquals } from '@std/assert';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { validateArchiveEntries } from '#utils/backup/archive.ts';
import { runCommand } from '#utils/command.ts';
import { mkdir, writeFile } from 'node:fs/promises';

class ArchiveValidationTest extends BaseTest {
	constructor() {
		super();
		this.registerTests();
	}

	private registerTests(): void {
		this.test('valid tar.gz with normal paths passes', async (ctx) => {
			// Create a simple directory structure and tar it
			const dataDir = `${ctx.tempDir}/data`;
			await mkdir(dataDir, { recursive: true });
			await writeFile(`${dataDir}/file.txt`, 'hello');
			await writeFile(`${dataDir}/config.db`, 'dbdata');

			const archivePath = `${ctx.tempDir}/backup-test.tar.gz`;
			await runCommand('tar', ['-czf', archivePath, '-C', ctx.tempDir, 'data']);

			const result = await validateArchiveEntries(archivePath);
			assertEquals(result.valid, true);
			assertEquals(result.error, undefined);
		});

		this.test('tar with ../ path entry fails', async (ctx) => {
			// Create a file, then tar it with a path traversal entry using --transform
			const dataDir = `${ctx.tempDir}/data`;
			await mkdir(dataDir, { recursive: true });
			await writeFile(`${dataDir}/evil.txt`, 'malicious');

			const archivePath = `${ctx.tempDir}/evil.tar.gz`;
			await runCommand('tar', [
				'-czf',
				archivePath,
				'--transform',
				's|data/evil.txt|../../etc/evil.txt|',
				'-C',
				ctx.tempDir,
				'data/evil.txt'
			]);

			const result = await validateArchiveEntries(archivePath);
			assertEquals(result.valid, false);
			assertEquals(typeof result.error, 'string');
		});

		this.test('tar with absolute path entry fails', async (ctx) => {
			// Create a file, then tar it with an absolute path using --transform
			const dataDir = `${ctx.tempDir}/data`;
			await mkdir(dataDir, { recursive: true });
			await writeFile(`${dataDir}/abs.txt`, 'absolute');

			const archivePath = `${ctx.tempDir}/abs.tar.gz`;
			await runCommand('tar', [
				'-czf',
				archivePath,
				'--transform',
				's|data/abs.txt|/etc/passwd|',
				'-C',
				ctx.tempDir,
				'data/abs.txt'
			]);

			const result = await validateArchiveEntries(archivePath);
			assertEquals(result.valid, false);
			assertEquals(typeof result.error, 'string');
		});
	}
}

const test = new ArchiveValidationTest();
await test.run();
