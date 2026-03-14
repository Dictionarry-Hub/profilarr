/**
 * Unit tests for archive validation (zip slip protection).
 */

import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { validateArchiveEntries } from '../../../src/lib/server/utils/backup/archive.ts';

class ArchiveValidationTest extends BaseTest {
	constructor() {
		super();
		this.registerTests();
	}

	private registerTests(): void {
		this.test('valid tar.gz with normal paths passes', async (ctx) => {
			// Create a simple directory structure and tar it
			const dataDir = `${ctx.tempDir}/data`;
			await Deno.mkdir(dataDir, { recursive: true });
			await Deno.writeTextFile(`${dataDir}/file.txt`, 'hello');
			await Deno.writeTextFile(`${dataDir}/config.db`, 'dbdata');

			const archivePath = `${ctx.tempDir}/backup-test.tar.gz`;
			const cmd = new Deno.Command('tar', {
				args: ['-czf', archivePath, '-C', ctx.tempDir, 'data'],
				stdout: 'null',
				stderr: 'null'
			});
			await cmd.output();

			const result = await validateArchiveEntries(archivePath);
			assertEquals(result.valid, true);
			assertEquals(result.error, undefined);
		});

		this.test('tar with ../ path entry fails', async (ctx) => {
			// Create a file, then tar it with a path traversal entry using --transform
			const dataDir = `${ctx.tempDir}/data`;
			await Deno.mkdir(dataDir, { recursive: true });
			await Deno.writeTextFile(`${dataDir}/evil.txt`, 'malicious');

			const archivePath = `${ctx.tempDir}/evil.tar.gz`;
			const cmd = new Deno.Command('tar', {
				args: [
					'-czf',
					archivePath,
					'--transform',
					's|data/evil.txt|../../etc/evil.txt|',
					'-C',
					ctx.tempDir,
					'data/evil.txt'
				],
				stdout: 'null',
				stderr: 'null'
			});
			await cmd.output();

			const result = await validateArchiveEntries(archivePath);
			assertEquals(result.valid, false);
			assertEquals(typeof result.error, 'string');
		});

		this.test('tar with absolute path entry fails', async (ctx) => {
			// Create a file, then tar it with an absolute path using --transform
			const dataDir = `${ctx.tempDir}/data`;
			await Deno.mkdir(dataDir, { recursive: true });
			await Deno.writeTextFile(`${dataDir}/abs.txt`, 'absolute');

			const archivePath = `${ctx.tempDir}/abs.tar.gz`;
			const cmd = new Deno.Command('tar', {
				args: [
					'-czf',
					archivePath,
					'--transform',
					's|data/abs.txt|/etc/passwd|',
					'-C',
					ctx.tempDir,
					'data/abs.txt'
				],
				stdout: 'null',
				stderr: 'null'
			});
			await cmd.output();

			const result = await validateArchiveEntries(archivePath);
			assertEquals(result.valid, false);
			assertEquals(typeof result.error, 'string');
		});
	}
}

const test = new ArchiveValidationTest();
await test.run();
