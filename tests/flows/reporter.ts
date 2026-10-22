/**
 * Flow suite reporter: one line per scenario folder as it finishes, then
 * every failure in full at the end.
 *
 *   ✓ databases          2/2   3.1s
 *   ✗ quality-profiles   3/4   6.0s
 *
 *   ──── 1 failure ────
 *   ✗ quality-profiles › a custom format score edit persists
 *     scenarios/quality-profiles/edit-score.spec.ts:12
 *     <error with expected/received and the failing line>
 *     Output: <what the test printed, if anything>
 *     Trace: test-results/.../trace.zip
 */

import { relative, sep } from 'node:path';
import type {
	FullConfig,
	FullResult,
	Reporter,
	Suite,
	TestCase,
	TestError,
	TestResult
} from '@playwright/test/reporter';

const color = (code: number) => (text: string) =>
	process.env.NO_COLOR ? text : `\x1b[${code}m${text}\x1b[0m`;
const green = color(32);
const red = color(31);
const dim = color(2);

interface Group {
	total: number;
	done: number;
	passed: number;
	startedAt: number;
}

interface Failure {
	group: string;
	test: TestCase;
	result: TestResult;
}

export default class FlowReporter implements Reporter {
	private rootDir = '';
	private testDir = '';
	private groups = new Map<string, Group>();
	private failures: Failure[] = [];
	private errors: TestError[] = [];
	private startedAt = Date.now();
	private width = 0;

	printsToStdio(): boolean {
		return true;
	}

	onBegin(config: FullConfig, suite: Suite): void {
		// Show paths relative to the repo, where the suite runs from
		this.rootDir = process.cwd();
		this.testDir = config.projects[0]?.testDir ?? config.rootDir;
		const tests = suite.allTests();
		for (const test of tests) {
			const name = this.groupOf(test);
			const group = this.groups.get(name) ?? { total: 0, done: 0, passed: 0, startedAt: 0 };
			group.total++;
			this.groups.set(name, group);
		}
		this.width = Math.max(10, ...[...this.groups.keys()].map((name) => name.length));
		// Playwright never starts more workers than there are tests
		const workers = Math.min(config.workers, tests.length);
		console.log(
			`Running ${tests.length} scenario${tests.length === 1 ? '' : 's'} in ${workers} worker${workers === 1 ? '' : 's'}\n`
		);
	}

	onTestBegin(test: TestCase): void {
		const group = this.groups.get(this.groupOf(test));
		if (group && group.startedAt === 0) group.startedAt = Date.now();
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		// Only the final attempt counts when retries are on
		if (result.status !== 'passed' && result.retry < test.retries) return;

		const name = this.groupOf(test);
		const group = this.groups.get(name);
		if (!group) return;
		group.done++;
		if (test.outcome() === 'expected' || test.outcome() === 'flaky') group.passed++;
		else if (test.outcome() === 'unexpected') this.failures.push({ group: name, test, result });

		if (group.done === group.total) {
			const ok = group.passed === group.total;
			const time = `${((Date.now() - group.startedAt) / 1000).toFixed(1)}s`;
			console.log(
				`  ${ok ? green('✓') : red('✗')} ${name.padEnd(this.width)}  ${`${group.passed}/${group.total}`.padStart(5)}  ${time.padStart(6)}`
			);
		}
	}

	onError(error: TestError): void {
		this.errors.push(error);
	}

	onEnd(result: FullResult): void {
		const issues = this.failures.length + this.errors.length;
		if (issues > 0) {
			console.log(
				`\n${red(`──── ${issues} failure${issues === 1 ? '' : 's'} `)}${red('─'.repeat(24))}`
			);
			for (const error of this.errors) {
				console.log(`\n${red('✗')} Run error`);
				console.log(indent(formatError(error)));
			}
			for (const { group, test, result: testResult } of this.failures) {
				console.log(`\n${red('✗')} ${group} › ${test.title}`);
				// Point at the failing line when Playwright knows it, else where the test starts
				const where = testResult.errors.find((error) => error.location)?.location ?? test.location;
				console.log(dim(`  ${relative(this.rootDir, where.file)}:${where.line}`));
				for (const error of testResult.errors) console.log(indent(formatError(error)));
				// What the test printed; hidden while running, shown only for failures
				const output = [...testResult.stdout, ...testResult.stderr].map(String).join('').trimEnd();
				if (output) {
					console.log(`\n${dim('  Output:')}`);
					console.log(output.replace(/^/gm, '    '));
				}
				for (const attachment of testResult.attachments) {
					if (attachment.path && ['trace', 'screenshot'].includes(attachment.name)) {
						const label = attachment.name === 'trace' ? 'Trace' : 'Screenshot';
						console.log(dim(`  ${label}: ${relative(this.rootDir, attachment.path)}`));
					}
				}
			}
		}

		const passed = [...this.groups.values()].reduce((sum, group) => sum + group.passed, 0);
		const failed = this.failures.length;
		const time = `${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`;
		const summary = `${passed} passed${failed ? `, ${failed} failed` : ''} in ${time}`;
		console.log(`\n${result.status === 'passed' ? green(summary) : red(summary)}`);
	}

	/** The first folder under the test dir, or "(root)" for top-level files */
	private groupOf(test: TestCase): string {
		const parts = relative(this.testDir, test.location.file).split(sep);
		return parts.length > 1 ? parts[0] : '(root)';
	}
}

function formatError(error: TestError): string {
	const message = error.message ?? error.value ?? 'Unknown error';
	return error.snippet ? `${message}\n\n${error.snippet}` : message;
}

function indent(text: string): string {
	return `\n${text
		.split('\n')
		.map((line) => `  ${line}`)
		.join('\n')}`;
}
