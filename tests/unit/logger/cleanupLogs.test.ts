/**
 * Tests for cleanupLogs job
 * Tests the cleanup of daily log files based on retention policy
 */

import { BaseTest } from '../base/BaseTest.ts';
import { cleanupLogs } from '../../../src/lib/server/jobs/logic/cleanupLogs.ts';
import { assertEquals } from '@std/assert';

class CleanupLogsTest extends BaseTest {
	/**
	 * Test 1: Deletes files older than retention period
	 */
	testDeletesOldFiles(): void {
		this.test('deletes files older than retention period', async (context) => {
			// Setup: Create log files with dates
			const today = new Date();
			const oldDate = new Date(today);
			oldDate.setDate(oldDate.getDate() - 35); // 35 days ago (older than 30 day retention)

			const oldLogFile = `${context.tempDir}/${oldDate.toISOString().split('T')[0]}.log`;
			await Deno.writeTextFile(oldLogFile, JSON.stringify({ test: 'old log' }) + '\n');

			// Assert old file exists before cleanup
			await this.assertFileExists(oldLogFile);

			// Run cleanup with 30 days retention
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert 1 file was deleted, no errors
			assertEquals(result.deletedCount, 1);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);

			// Assert old file was deleted
			await this.assertFileNotExists(oldLogFile);
		});
	}

	/**
	 * Test 2: Keeps files within retention period
	 */
	testKeepsRecentFiles(): void {
		this.test('keeps files within retention period', async (context) => {
			// Setup: Create a recent log file
			const today = new Date();
			const recentDate = new Date(today);
			recentDate.setDate(recentDate.getDate() - 10); // 10 days ago (within 30 day retention)

			const recentLogFile = `${context.tempDir}/${recentDate.toISOString().split('T')[0]}.log`;
			await Deno.writeTextFile(recentLogFile, JSON.stringify({ test: 'recent log' }) + '\n');

			// Assert recent file exists before cleanup
			await this.assertFileExists(recentLogFile);

			// Run cleanup with 30 days retention
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert no files were deleted, no errors
			assertEquals(result.deletedCount, 0);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);

			// Assert recent file still exists
			await this.assertFileExists(recentLogFile);
		});
	}

	/**
	 * Test 3: Correctly parses YYYY-MM-DD.log format
	 */
	testParsesDateFormat(): void {
		this.test('correctly parses YYYY-MM-DD.log format', async (context) => {
			// Setup: Create log files with valid date format
			const today = new Date();

			// Recent file (6 days old - should keep)
			const recentDate = new Date(today);
			recentDate.setDate(recentDate.getDate() - 6);
			const recentFile = `${context.tempDir}/${recentDate.toISOString().split('T')[0]}.log`;
			await Deno.writeTextFile(recentFile, JSON.stringify({ test: 'recent' }) + '\n');

			// Old file (36 days old - should delete)
			const oldDate = new Date(today);
			oldDate.setDate(oldDate.getDate() - 36);
			const oldFile = `${context.tempDir}/${oldDate.toISOString().split('T')[0]}.log`;
			await Deno.writeTextFile(oldFile, JSON.stringify({ test: 'old' }) + '\n');

			// Assert both files exist before cleanup
			await this.assertFileExists(recentFile);
			await this.assertFileExists(oldFile);

			// Run cleanup with 30 days retention
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert only 1 file was deleted (the old one)
			assertEquals(result.deletedCount, 1);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);

			// Assert recent file still exists, old file was deleted
			await this.assertFileExists(recentFile);
			await this.assertFileNotExists(oldFile);
		});
	}

	/**
	 * Test 4: Ignores files that don't match pattern
	 */
	testIgnoresInvalidPatterns(): void {
		this.test("ignores files that don't match pattern", async (context) => {
			// Setup: Create files with various invalid names
			const invalidFiles = [
				`${context.tempDir}/app.log`, // No date
				`${context.tempDir}/backup.txt`, // Not a log file
				`${context.tempDir}/2025-10-15.txt`, // Wrong extension
				`${context.tempDir}/log-2025-10-15.log` // Date in wrong position
			];

			// Create all invalid files
			for (const file of invalidFiles) {
				await Deno.writeTextFile(file, 'test content\n');
			}

			// Create one valid old file (36 days old - should be deleted)
			const today = new Date();
			const oldDate = new Date(today);
			oldDate.setDate(oldDate.getDate() - 36);
			const validOldFile = `${context.tempDir}/${oldDate.toISOString().split('T')[0]}.log`;
			await Deno.writeTextFile(validOldFile, JSON.stringify({ test: 'old' }) + '\n');

			// Assert all files exist before cleanup
			for (const file of invalidFiles) {
				await this.assertFileExists(file);
			}
			await this.assertFileExists(validOldFile);

			// Run cleanup with 30 days retention
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert only 1 file was deleted (the valid old file)
			assertEquals(result.deletedCount, 1);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);

			// Assert all invalid files still exist
			for (const file of invalidFiles) {
				await this.assertFileExists(file);
			}

			// Assert valid old file was deleted
			await this.assertFileNotExists(validOldFile);
		});
	}

	/**
	 * Test 5: Handles empty logs directory
	 */
	testHandlesEmptyDirectory(): void {
		this.test('handles empty logs directory', async (context) => {
			// Setup: context.tempDir is already created but empty (no files)
			// No need to create any files

			// Run cleanup with 30 days retention on empty directory
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert no files were processed, no errors
			assertEquals(result.deletedCount, 0);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);
		});
	}

	/**
	 * Test 6: Handles non-existent logs directory
	 */
	testHandlesNonExistentDirectory(): void {
		this.test('handles non-existent logs directory', async (context) => {
			// Setup: Create a path to a directory that doesn't exist
			const nonExistentDir = `${context.tempDir}/does-not-exist`;

			// Attempt to run cleanup on non-existent directory
			// This should throw an error
			try {
				await cleanupLogs(nonExistentDir, 30);
				throw new Error("Expected cleanupLogs to throw an error, but it didn't");
			} catch (error) {
				// Assert that we got a meaningful error about failing to read directory
				const errorMessage = error instanceof Error ? error.message : String(error);
				if (!errorMessage.includes('Failed to read logs directory')) {
					throw new Error(
						`Expected error message to include "Failed to read logs directory", but got: ${errorMessage}`
					);
				}
			}
		});
	}

	/**
	 * Test 7: File exactly on retention boundary
	 */
	testRetentionBoundary(): void {
		this.test('file exactly on retention boundary', async (context) => {
			// Setup: Create a file exactly 30 days old
			const today = new Date();
			const boundaryDate = new Date(today);
			boundaryDate.setDate(boundaryDate.getDate() - 30); // Exactly 30 days ago

			const boundaryFile = `${context.tempDir}/${boundaryDate.toISOString().split('T')[0]}.log`;
			await Deno.writeTextFile(boundaryFile, JSON.stringify({ test: 'boundary log' }) + '\n');

			// Assert file exists before cleanup
			await this.assertFileExists(boundaryFile);

			// Run cleanup with 30 days retention
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert no files were deleted (boundary file should be kept)
			assertEquals(result.deletedCount, 0);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);

			// Assert boundary file still exists (30 days old is within retention)
			await this.assertFileExists(boundaryFile);
		});
	}

	/**
	 * Test 8: Multiple old files - deletes all
	 */
	testDeletesMultipleOldFiles(): void {
		this.test('multiple old files - deletes all', async (context) => {
			// Setup: Create multiple old log files
			const today = new Date();
			const oldDays = [35, 40, 45, 50]; // All older than 30 day retention
			const oldFiles: string[] = [];

			for (const days of oldDays) {
				const oldDate = new Date(today);
				oldDate.setDate(oldDate.getDate() - days);
				const oldFile = `${context.tempDir}/${oldDate.toISOString().split('T')[0]}.log`;
				await Deno.writeTextFile(
					oldFile,
					JSON.stringify({ test: `log from ${days} days ago` }) + '\n'
				);
				oldFiles.push(oldFile);
			}

			// Assert all old files exist before cleanup
			for (const file of oldFiles) {
				await this.assertFileExists(file);
			}

			// Run cleanup with 30 days retention
			const result = await cleanupLogs(context.tempDir, 30);

			// Assert all 4 files were deleted, no errors
			assertEquals(result.deletedCount, 4);
			assertEquals(result.errorCount, 0);
			assertEquals(result.errors.length, 0);

			// Assert all old files were deleted
			for (const file of oldFiles) {
				await this.assertFileNotExists(file);
			}
		});
	}

	runTests(): void {
		this.testDeletesOldFiles();
		this.testKeepsRecentFiles();
		this.testParsesDateFormat();
		this.testIgnoresInvalidPatterns();
		this.testHandlesEmptyDirectory();
		this.testHandlesNonExistentDirectory();
		this.testRetentionBoundary();
		this.testDeletesMultipleOldFiles();
	}
}

// Run tests
const test = new CleanupLogsTest();
await test.runTests();
