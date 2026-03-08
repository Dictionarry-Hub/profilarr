/**
 * Tests for createBackup job
 * Tests the creation of compressed backups
 */

import { BaseTest } from '../base/BaseTest.ts';
import { createBackup } from '../../../src/lib/server/jobs/logic/createBackup.ts';
import { assertEquals } from '@std/assert';

class CreateBackupTest extends BaseTest {
	/**
	 * Test 1: Basic successful backup
	 */
	testBasicSuccessfulBackup(): void {
		this.test('basic successful backup', async (context) => {
			// Setup: Create source directory with test files
			const sourceDir = `${context.tempDir}/source`;
			await Deno.mkdir(sourceDir, { recursive: true });

			// Create some test files
			await Deno.writeTextFile(`${sourceDir}/file1.txt`, 'test content 1\n');
			await Deno.writeTextFile(`${sourceDir}/file2.txt`, 'test content 2\n');
			await Deno.writeTextFile(`${sourceDir}/file3.json`, JSON.stringify({ test: 'data' }) + '\n');

			// Create backup directory
			const backupDir = `${context.tempDir}/backups`;

			// Run backup
			const result = await createBackup(sourceDir, backupDir);

			// Assert success
			assertEquals(result.success, true);
			assertEquals(typeof result.filename, 'string');
			assertEquals(typeof result.sizeBytes, 'number');

			// Assert size is greater than 0
			if (result.sizeBytes) {
				assertEquals(result.sizeBytes > 0, true);
			}

			// Assert no error
			assertEquals(result.error, undefined);
		});
	}

	/**
	 * Test 2: Backup filename format
	 */
	testBackupFilenameFormat(): void {
		this.test('backup filename format', async (context) => {
			// Setup: Create source directory with test files
			const sourceDir = `${context.tempDir}/source`;
			await Deno.mkdir(sourceDir, { recursive: true });
			await Deno.writeTextFile(`${sourceDir}/test.txt`, 'content\n');

			const backupDir = `${context.tempDir}/backups`;

			// Use a custom timestamp for predictable filename
			const customTimestamp = new Date('2025-01-15T14:30:45.000Z');

			// Run backup with custom timestamp
			const result = await createBackup(sourceDir, backupDir, customTimestamp);

			// Assert success
			assertEquals(result.success, true);

			// Assert filename matches expected format: backup-2025-01-15-143045.tar.gz
			assertEquals(result.filename, 'backup-2025-01-15-143045.tar.gz');
		});
	}

	/**
	 * Test 3: Backup file exists and is valid
	 */
	testBackupFileExistsAndValid(): void {
		this.test('backup file exists and is valid', async (context) => {
			// Setup: Create source directory with test files
			const sourceDir = `${context.tempDir}/source`;
			await Deno.mkdir(sourceDir, { recursive: true });
			await Deno.writeTextFile(`${sourceDir}/file1.txt`, 'test content\n');
			await Deno.writeTextFile(`${sourceDir}/file2.txt`, 'more content\n');

			const backupDir = `${context.tempDir}/backups`;

			// Run backup
			const result = await createBackup(sourceDir, backupDir);

			// Assert success
			assertEquals(result.success, true);

			// Construct backup file path
			const backupFilePath = `${backupDir}/${result.filename}`;

			// Assert backup file exists
			await this.assertFileExists(backupFilePath);

			// Get file stats and verify size
			const stat = await Deno.stat(backupFilePath);
			assertEquals(stat.size > 0, true);

			// Verify returned sizeBytes matches actual file size
			assertEquals(result.sizeBytes, stat.size);
		});
	}

	/**
	 * Test 4: Backup contains expected files
	 */
	testBackupContainsExpectedFiles(): void {
		this.test('backup contains expected files', async (context) => {
			// Setup: Create source directory with specific test files
			const sourceDir = `${context.tempDir}/source`;
			await Deno.mkdir(sourceDir, { recursive: true });

			const testContent1 = 'This is test file 1\n';
			const testContent2 = 'This is test file 2\n';
			const testContent3 = JSON.stringify({ key: 'value', data: [1, 2, 3] });

			await Deno.writeTextFile(`${sourceDir}/file1.txt`, testContent1);
			await Deno.writeTextFile(`${sourceDir}/file2.txt`, testContent2);
			await Deno.writeTextFile(`${sourceDir}/data.json`, testContent3);

			const backupDir = `${context.tempDir}/backups`;

			// Run backup
			const result = await createBackup(sourceDir, backupDir);

			// Assert success
			assertEquals(result.success, true);

			// Extract backup to verify contents
			const extractDir = `${context.tempDir}/extract`;
			await Deno.mkdir(extractDir, { recursive: true });

			const backupFilePath = `${backupDir}/${result.filename}`;

			// Extract tar.gz
			const extractCommand = new Deno.Command('tar', {
				args: ['-xzf', backupFilePath, '-C', extractDir],
				stdout: 'piped',
				stderr: 'piped'
			});

			const { code } = await extractCommand.output();
			assertEquals(code, 0);

			// Verify extracted files exist and have correct content
			const extractedSourceDir = `${extractDir}/data`;
			await this.assertFileExists(`${extractedSourceDir}/file1.txt`);
			await this.assertFileExists(`${extractedSourceDir}/file2.txt`);
			await this.assertFileExists(`${extractedSourceDir}/data.json`);

			// Verify file contents
			const extractedContent1 = await Deno.readTextFile(`${extractedSourceDir}/file1.txt`);
			const extractedContent2 = await Deno.readTextFile(`${extractedSourceDir}/file2.txt`);
			const extractedContent3 = await Deno.readTextFile(`${extractedSourceDir}/data.json`);

			assertEquals(extractedContent1, testContent1);
			assertEquals(extractedContent2, testContent2);
			assertEquals(extractedContent3, testContent3);
		});
	}

	/**
	 * Test 5: Non-existent source directory
	 */
	testNonExistentSourceDirectory(): void {
		this.test('non-existent source directory', async (context) => {
			// Setup: Create path to non-existent directory
			const sourceDir = `${context.tempDir}/does-not-exist`;
			const backupDir = `${context.tempDir}/backups`;

			// Run backup on non-existent directory
			const result = await createBackup(sourceDir, backupDir);

			// Assert failure
			assertEquals(result.success, false);

			// Assert error message mentions source directory
			assertEquals(typeof result.error, 'string');
			if (result.error) {
				assertEquals(result.error.includes('Source directory does not exist'), true);
			}

			// Assert no filename or size returned
			assertEquals(result.filename, undefined);
			assertEquals(result.sizeBytes, undefined);
		});
	}

	/**
	 * Test 6: Source path is a file, not directory
	 */
	testSourcePathIsFile(): void {
		this.test('source path is a file, not directory', async (context) => {
			// Setup: Create a file instead of a directory
			const sourcePath = `${context.tempDir}/somefile.txt`;
			await Deno.writeTextFile(sourcePath, 'this is a file\n');

			const backupDir = `${context.tempDir}/backups`;

			// Run backup on file path
			const result = await createBackup(sourcePath, backupDir);

			// Assert failure
			assertEquals(result.success, false);

			// Assert error message mentions not a directory
			assertEquals(typeof result.error, 'string');
			if (result.error) {
				assertEquals(result.error.includes('Source path is not a directory'), true);
			}

			// Assert no filename or size returned
			assertEquals(result.filename, undefined);
			assertEquals(result.sizeBytes, undefined);
		});
	}

	/**
	 * Test 7: Empty source directory
	 */
	testEmptySourceDirectory(): void {
		this.test('empty source directory', async (context) => {
			// Setup: Create an empty source directory
			const sourceDir = `${context.tempDir}/empty-source`;
			await Deno.mkdir(sourceDir, { recursive: true });

			const backupDir = `${context.tempDir}/backups`;

			// Run backup on empty directory
			const result = await createBackup(sourceDir, backupDir);

			// Assert success
			assertEquals(result.success, true);
			assertEquals(typeof result.filename, 'string');
			assertEquals(typeof result.sizeBytes, 'number');

			// Assert backup file exists
			const backupFilePath = `${backupDir}/${result.filename}`;
			await this.assertFileExists(backupFilePath);

			// Assert file has size > 0 (even empty tar.gz has some size for headers)
			if (result.sizeBytes) {
				assertEquals(result.sizeBytes > 0, true);
			}

			// Extract and verify empty directory structure is preserved
			const extractDir = `${context.tempDir}/extract`;
			await Deno.mkdir(extractDir, { recursive: true });

			const extractCommand = new Deno.Command('tar', {
				args: ['-xzf', backupFilePath, '-C', extractDir],
				stdout: 'piped',
				stderr: 'piped'
			});

			const { code } = await extractCommand.output();
			assertEquals(code, 0);

			// Verify extracted directory exists and is empty
			const extractedSourceDir = `${extractDir}/data`;
			await this.assertFileExists(extractedSourceDir);

			// Read directory to verify it's empty
			const entries = [];
			for await (const entry of Deno.readDir(extractedSourceDir)) {
				entries.push(entry);
			}
			assertEquals(entries.length, 0);
		});
	}

	runTests(): void {
		this.testBasicSuccessfulBackup();
		this.testBackupFilenameFormat();
		this.testBackupFileExistsAndValid();
		this.testBackupContainsExpectedFiles();
		this.testNonExistentSourceDirectory();
		this.testSourcePathIsFile();
		this.testEmptySourceDirectory();
	}
}

// Run tests
const test = new CreateBackupTest();
await test.runTests();
