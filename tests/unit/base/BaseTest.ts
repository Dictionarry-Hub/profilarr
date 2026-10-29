/**
 * Base test class providing common test utilities and lifecycle hooks
 * Extend this class to create test suites with automatic setup/teardown
 */

import { test } from 'vitest';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import { assertExists } from '@std/assert';
import { isNotFound } from '#utils/fs.ts';

export interface TestContext {
	/** Unique temporary directory for this test */
	tempDir: string;
	/** Test name */
	name: string;
}

/**
 * Abstract base class for tests
 * Provides lifecycle hooks and common utilities
 */
export abstract class BaseTest {
	private static testCounter = 0;
	protected context: TestContext | null = null;

	/**
	 * Run before all tests in this suite (optional)
	 * Override this in your test class if needed
	 */
	protected beforeAll(): void | Promise<void> {
		// Override in subclass if needed
	}

	/**
	 * Run after all tests in this suite (optional)
	 * Override this in your test class if needed
	 */
	protected afterAll(): void | Promise<void> {
		// Override in subclass if needed
	}

	/**
	 * Run before each individual test (optional)
	 * Override this in your test class if needed
	 */
	protected beforeEach(_context: TestContext): void | Promise<void> {
		// Override in subclass if needed
	}

	/**
	 * Run after each individual test (optional)
	 * Override this in your test class if needed
	 */
	protected afterEach(_context: TestContext): void | Promise<void> {
		// Override in subclass if needed
	}

	/**
	 * Create a temporary directory for a test
	 * Automatically cleaned up after test completes
	 */
	protected async createTempDir(testName: string): Promise<string> {
		const counter = BaseTest.testCounter++;
		const timestamp = Date.now();
		const sanitizedName = testName.replace(/[^a-zA-Z0-9]/g, '_');
		const tempDir = `/tmp/profilarr-tests/${sanitizedName}_${timestamp}_${counter}`;
		await mkdir(tempDir, { recursive: true });
		return tempDir;
	}

	/**
	 * Clean up a temporary directory and all its contents
	 */
	protected async cleanupTempDir(tempDir: string): Promise<void> {
		try {
			await rm(tempDir, { recursive: true });
		} catch (error) {
			// Ignore errors during cleanup
			console.warn(`Failed to cleanup temp dir ${tempDir}:`, error);
		}
	}

	/**
	 * Assert that a file exists at the given path
	 */
	protected async assertFileExists(filePath: string, message?: string): Promise<void> {
		try {
			const info = await stat(filePath);
			assertExists(info, message ?? `File should exist: ${filePath}`);
		} catch (error) {
			throw new Error(message ?? `Expected file to exist: ${filePath}, but got error: ${error}`);
		}
	}

	/**
	 * Assert that a file does NOT exist at the given path
	 */
	protected async assertFileNotExists(filePath: string, message?: string): Promise<void> {
		try {
			await stat(filePath);
			throw new Error(message ?? `Expected file to NOT exist: ${filePath}`);
		} catch (error) {
			if (!isNotFound(error)) {
				throw error;
			}
			// File doesn't exist - this is what we want
		}
	}

	/**
	 * Assert that a file contains specific text
	 */
	protected async assertFileContains(
		filePath: string,
		expectedText: string,
		message?: string
	): Promise<void> {
		const content = await readFile(filePath, 'utf8');
		if (!content.includes(expectedText)) {
			throw new Error(
				message ??
					`Expected file ${filePath} to contain "${expectedText}", but it didn't.\nFile content: ${content}`
			);
		}
	}

	/**
	 * Assert that a file matches a regex pattern
	 */
	protected async assertFileMatches(
		filePath: string,
		pattern: RegExp,
		message?: string
	): Promise<void> {
		const content = await readFile(filePath, 'utf8');
		if (!pattern.test(content)) {
			throw new Error(
				message ??
					`Expected file ${filePath} to match pattern ${pattern}, but it didn't.\nFile content: ${content}`
			);
		}
	}

	/**
	 * Read and parse JSON log file
	 */
	protected async readJsonLines(filePath: string): Promise<unknown[]> {
		const content = await readFile(filePath, 'utf8');
		const lines = content.split('\n').filter((line) => line.trim());
		return lines.map((line) => JSON.parse(line));
	}

	/**
	 * Wait for a condition to become true with timeout
	 */
	protected async waitFor(
		condition: () => boolean | Promise<boolean>,
		timeoutMs = 5000,
		checkIntervalMs = 100
	): Promise<void> {
		const startTime = Date.now();
		while (Date.now() - startTime < timeoutMs) {
			if (await condition()) {
				return;
			}
			await this.sleep(checkIntervalMs);
		}
		throw new Error(`Timeout waiting for condition after ${timeoutMs}ms`);
	}

	/**
	 * Wait for a file to exist
	 */
	protected async waitForFile(filePath: string, timeoutMs = 5000): Promise<void> {
		await this.waitFor(async () => {
			try {
				await stat(filePath);
				return true;
			} catch {
				return false;
			}
		}, timeoutMs);
	}

	/**
	 * Sleep for specified milliseconds
	 */
	protected async sleep(ms: number): Promise<void> {
		await new Promise((resolve) => setTimeout(resolve, ms));
	}

	/**
	 * Register and run a test with automatic setup/teardown
	 */
	protected test(name: string, fn: (context: TestContext) => Promise<void> | void): void {
		test(`${this.constructor.name}: ${name}`, async () => {
			// Create temp directory for this test
			const tempDir = await this.createTempDir(name);
			const context: TestContext = { tempDir, name };
			this.context = context;

			try {
				// Run beforeEach hook
				await this.beforeEach(context);

				// Run the actual test
				await fn(context);
			} finally {
				// Run afterEach hook
				await this.afterEach(context);

				// Cleanup temp directory
				await this.cleanupTempDir(tempDir);

				this.context = null;
			}
		});
	}

	/**
	 * Run the test suite
	 * Call this method to execute all tests defined in your subclass
	 */
	async run(): Promise<void> {
		// Run beforeAll hook
		await this.beforeAll();

		// Tests are registered via this.test() calls in the subclass constructor or setup method
		// Vitest will handle running them

		// Note: afterAll is never called; tests should clean up in afterEach
	}
}
