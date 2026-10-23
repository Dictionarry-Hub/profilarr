/**
 * Flow suite reporter: a tree of test folders, then every failure in full at
 * the end. Each folder line counts every test beneath it, at any depth. A top
 * folder prints its tree once its last test finishes.
 *
 *   ✓ scenarios                 3/4    6.0s
 *     ✓ entities                3/4    6.0s
 *       ✗ quality-profiles      2/3    4.2s
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
	startedAt: number;
	endedAt: number;
}

const newFolder = (name: string): Folder => ({
	name,
	children: new Map(),
	total: 0,
	done: 0,
	passed: 0,
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
		if (result.status !== 'passed' && result.retry < test.retries) return;

		const chain = this.chainOf(test);
		const passed = test.outcome() === 'expected' || test.outcome() === 'flaky';
		for (const folder of chain) {
			folder.done++;
			if (passed) folder.passed++;
			folder.endedAt = Date.now();
		}
		if (test.outcome() === 'unexpected') {
			const path = this.foldersOf(test).join(' › ');
			this.failures.push({ path, test, result });
		}

		const top = chain[0];
		if (top && top.done === top.total) this.printTree(top, 0);
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

		const passed = [...this.root.children.values()].reduce((sum, top) => sum + top.passed, 0);
		const failed = this.failures.length;
		const time = `${((Date.now() - this.startedAt) / 1000).toFixed(1)}s`;
		const summary = `${passed} passed${failed ? `, ${failed} failed` : ''} in ${time}`;
		console.log(`\n${result.status === 'passed' ? green(summary) : red(summary)}`);
	}

	/** The test's folders under the test dir, outermost first, or "(root)" for top-level files */
	private foldersOf(test: TestCase): string[] {
		const folders = relative(this.testDir, test.location.file).split(sep).slice(0, -1);
		return folders.length > 0 ? folders : ['(root)'];
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
		const ok = folder.passed === folder.total;
		const label = `${'  '.repeat(depth)}${ok ? green('✓') : red('✗')} ${folder.name}`;
		const pad = ' '.repeat(Math.max(0, this.width - depth * 2 - folder.name.length));
		const count = `${folder.passed}/${folder.total}`.padStart(this.countWidth);
		const time = `${((folder.endedAt - folder.startedAt) / 1000).toFixed(1)}s`.padStart(6);
		console.log(`  ${label}${pad}  ${count}  ${time}`);
		const children = [...folder.children.values()].sort((a, b) => a.name.localeCompare(b.name));
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
