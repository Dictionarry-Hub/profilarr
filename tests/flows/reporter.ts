/**
 * Flow suite reporter: a line per test as it finishes, then a summary once the
 * run ends: a tree of test folders, every failure in full, and the counts. Each
 * folder line counts every test beneath it, at any depth, as passed out of the
 * tests that ran. Skipped tests are noted on the folder that holds them.
 * FLOWS_QUIET drops the per-test lines.
 *
 *   ✓ entities › custom-formats     a custom format renames                  1.8s
 *   ✗ entities › quality-profiles   a custom format score edit persists      4.2s
 *   - databases                     a database links from GitHub             0.1s
 *
 *   ── Summary ────────────────────────────
 *   ✗ scenarios                 3/4    6.0s
 *     ✓ databases               1/1    0.1s  1 skipped
 *     ✗ entities                2/3    6.0s
 *       ✗ quality-profiles      1/2    4.2s
 *       ✓ custom-formats        1/1    1.8s
 *
 *   ──── 1 failure ────
 *   ✗ scenarios › entities › quality-profiles › a custom format score edit persists
 *     tests/flows/scenarios/entities/quality-profiles/edit-score.spec.ts:12
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

/** A folder of tests, counting every test beneath it */
interface Folder {
	name: string;
	children: Map<string, Folder>;
	total: number;
	done: number;
	passed: number;
	skipped: number;
	startedAt: number;
	endedAt: number;
}

const newFolder = (name: string): Folder => ({
	name,
	children: new Map(),
	total: 0,
	done: 0,
	passed: 0,
	skipped: 0,
	startedAt: 0,
	endedAt: 0
});

interface Failure {
	path: string;
	test: TestCase;
	result: TestResult;
}

export default class FlowReporter implements Reporter {
	private rootDir = '';
	private testDir = '';
	private root = newFolder('');
	private failures: Failure[] = [];
	private errors: TestError[] = [];
	private startedAt = Date.now();
	private width = 0;
	private countWidth = 5;
	// Per-test lines are on unless the run asks for the summary only
	private quiet = !!process.env.FLOWS_QUIET;
	private areaWidth = 0;
	private titleWidth = 0;

	printsToStdio(): boolean {
		return true;
	}

	onBegin(config: FullConfig, suite: Suite): void {
		// Show paths relative to the repo, where the suite runs from
		this.rootDir = process.cwd();
		this.testDir = config.projects[0]?.testDir ?? config.rootDir;
		const tests = suite.allTests();
		for (const test of tests) {
			let folder = this.root;
			for (const name of this.foldersOf(test)) {
				const child = folder.children.get(name) ?? newFolder(name);
				folder.children.set(name, child);
				folder = child;
				folder.total++;
			}
		}
		this.width = Math.max(10, labelWidth(this.root, 0));
		// Per-test columns fit in 120: "  ✓ " area, 2 spaces, title, 2 spaces, 6 for the time
		this.areaWidth = Math.max(0, ...tests.map((test) => this.areaOf(test).length));
		this.titleWidth = Math.max(20, 120 - 4 - this.areaWidth - 2 - 2 - 6);
		// Wide enough for the largest count, e.g. "113/113"
		this.countWidth = Math.max(5, String(tests.length).length * 2 + 1);
		// Playwright never starts more workers than there are tests
		const workers = Math.min(config.workers, tests.length);
		console.log(
			`Running ${tests.length} scenario${tests.length === 1 ? '' : 's'} in ${workers} worker${workers === 1 ? '' : 's'}\n`
		);
	}

	onTestBegin(test: TestCase): void {
		for (const folder of this.chainOf(test)) {
			if (folder.startedAt === 0) folder.startedAt = Date.now();
		}
	}

	onTestEnd(test: TestCase, result: TestResult): void {
		// Only the final attempt counts when retries are on
		if (!['passed', 'skipped'].includes(result.status) && result.retry < test.retries) return;

		const chain = this.chainOf(test);
		const passed = test.outcome() === 'expected' || test.outcome() === 'flaky';
		const skipped = test.outcome() === 'skipped';
		for (const folder of chain) {
			folder.done++;
			if (passed) folder.passed++;
			if (skipped) folder.skipped++;
			folder.endedAt = Date.now();
		}
		if (test.outcome() === 'unexpected') {
			const path = this.foldersOf(test).join(' › ');
			this.failures.push({ path, test, result });
		}

		if (!this.quiet) {
			const mark = skipped ? dim('-') : passed ? green('✓') : red('✗');
			const area = this.areaOf(test).padEnd(this.areaWidth);
			const title = truncate(test.title, this.titleWidth).padEnd(this.titleWidth);
			const time = seconds(result.duration).padStart(6);
			console.log(`  ${mark} ${dim(area)}  ${skipped ? dim(title) : title}  ${dim(time)}`);
		}
	}

	onError(error: TestError): void {
		this.errors.push(error);
	}

	onEnd(result: FullResult): void {
		// The rule ends where the tree's time column does. Quiet runs already
		// have a blank line after the "Running" line.
		const rule = `── Summary ${'─'.repeat(this.width + this.countWidth + 1)}`;
		console.log(`${this.quiet ? '' : '\n'}  ${dim(rule)}`);
		const tops = [...this.root.children.values()].sort((a, b) => a.name.localeCompare(b.name));
		for (const top of tops) this.printTree(top, 0);

		const issues = this.failures.length + this.errors.length;
		if (issues > 0) {
			console.log(
				`\n${red(`──── ${issues} failure${issues === 1 ? '' : 's'} `)}${red('─'.repeat(24))}`
			);
			for (const error of this.errors) {
				console.log(`\n${red('✗')} Run error`);
				console.log(indent(formatError(error)));
			}
			for (const { path, test, result: testResult } of this.failures) {
				console.log(`\n${red('✗')} ${path} › ${test.title}`);
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

		const passed = tops.reduce((sum, top) => sum + top.passed, 0);
		const skipped = tops.reduce((sum, top) => sum + top.skipped, 0);
		const failed = this.failures.length;
		const time = seconds(Date.now() - this.startedAt);
		const paint = result.status === 'passed' ? green : red;
		const counts = paint(`${passed} passed${failed ? `, ${failed} failed` : ''}`);
		console.log(`\n${counts}${skipped ? dim(`, ${skipped} skipped`) : ''}${paint(` in ${time}`)}`);
	}

	/** The test's folders under the test dir, outermost first, or "(root)" for top-level files */
	private foldersOf(test: TestCase): string[] {
		const folders = relative(this.testDir, test.location.file).split(sep).slice(0, -1);
		return folders.length > 0 ? folders : ['(root)'];
	}

	/** The test's folders under scenarios/, e.g. "entities › custom-formats" */
	private areaOf(test: TestCase): string {
		const folders = this.foldersOf(test);
		return (folders[0] === 'scenarios' ? folders.slice(1) : folders).join(' › ');
	}

	/** The folder records for a test, outermost first */
	private chainOf(test: TestCase): Folder[] {
		const chain: Folder[] = [];
		let folder = this.root;
		for (const name of this.foldersOf(test)) {
			const child = folder.children.get(name);
			if (!child) break;
			chain.push(child);
			folder = child;
		}
		return chain;
	}

	/** Print a folder and everything beneath it, children in name order */
	private printTree(folder: Folder, depth: number): void {
		// Skipped tests neither pass nor fail: count passed out of those that ran
		const ran = folder.total - folder.skipped;
		const mark =
			folder.passed < ran ? red('✗') : ran === 0 && folder.skipped > 0 ? dim('-') : green('✓');
		const label = `${'  '.repeat(depth)}${mark} ${folder.name}`;
		const pad = ' '.repeat(Math.max(0, this.width - depth * 2 - folder.name.length));
		const count = `${folder.passed}/${ran}`.padStart(this.countWidth);
		const time = seconds(folder.endedAt - folder.startedAt).padStart(6);
		// Note skips only on the folder that holds the skipped tests, not its parents
		const children = [...folder.children.values()].sort((a, b) => a.name.localeCompare(b.name));
		const own = folder.skipped - children.reduce((sum, child) => sum + child.skipped, 0);
		const skipped = own ? dim(`  ${own} skipped`) : '';
		console.log(`  ${label}${pad}  ${count}  ${time}${skipped}`);
		for (const child of children) this.printTree(child, depth + 1);
	}
}

/** The widest folder label: its indent plus its name */
function labelWidth(folder: Folder, depth: number): number {
	let widest = 0;
	for (const child of folder.children.values()) {
		widest = Math.max(widest, depth * 2 + child.name.length, labelWidth(child, depth + 1));
	}
	return widest;
}

function seconds(ms: number): string {
	return `${(ms / 1000).toFixed(1)}s`;
}

/** Cut text to a width, ending it with "…" when it's too long */
function truncate(text: string, width: number): string {
	return text.length <= width ? text : `${text.slice(0, width - 1)}…`;
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
