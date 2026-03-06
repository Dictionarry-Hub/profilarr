/**
 * Simple test runner that gives us full control over output.
 * No Deno.test() — just runs functions and reports results.
 */

const c = {
	reset: '\x1b[0m',
	grey: '\x1b[90m',
	green: '\x1b[32m',
	red: '\x1b[31m',
	bold: '\x1b[1m',
	cyan: '\x1b[36m'
};

const line = `${c.grey}${'─'.repeat(60)}${c.reset}`;

interface Test {
	name: string;
	fn: () => Promise<void> | void;
}

const tests: Test[] = [];
let setupFn: (() => Promise<void> | void) | null = null;
let teardownFn: (() => Promise<void> | void) | null = null;

export function setup(fn: () => Promise<void> | void) {
	setupFn = fn;
}

export function teardown(fn: () => Promise<void> | void) {
	teardownFn = fn;
}

export function test(name: string, fn: () => Promise<void> | void) {
	tests.push({ name, fn });
}

export async function run(): Promise<void> {
	let passed = 0;
	let failed = 0;
	const failures: { name: string; error: unknown }[] = [];

	// Setup
	if (setupFn) {
		console.log(line);
		console.log(`${c.cyan}${c.bold} SETUP${c.reset}`);
		console.log(line);
		try {
			await setupFn();
		} catch (error) {
			console.error(`\n${c.red}${c.bold}Setup failed:${c.reset}`, error);
			Deno.exit(1);
		}
	}

	// Run tests
	for (let i = 0; i < tests.length; i++) {
		const t = tests[i];
		console.log(line);
		console.log(`${c.bold} TEST ${i + 1}/${tests.length}${c.reset} ${t.name}`);
		console.log(line);
		try {
			await t.fn();
			console.log(`${c.green}✓ pass${c.reset}`);
			passed++;
		} catch (error) {
			console.log(`${c.red}✗ fail${c.reset}`);
			failed++;
			failures.push({ name: t.name, error });
		}
	}

	// Teardown
	if (teardownFn) {
		console.log(line);
		console.log(`${c.cyan}${c.bold} TEARDOWN${c.reset}`);
		console.log(line);
		try {
			await teardownFn();
		} catch (error) {
			console.error(`${c.red}Teardown error:${c.reset}`, error);
		}
	}

	// Summary
	console.log(line);
	if (failures.length > 0) {
		console.log(`${c.red}${c.bold}Failures:${c.reset}`);
		for (const f of failures) {
			console.log(`  ${c.red}✗ ${f.name}${c.reset}`);
			console.log(`    ${f.error}\n`);
		}
	}
	console.log(
		`${passed > 0 ? c.green : ''}${passed} passed${c.reset}, ${failed > 0 ? c.red : c.grey}${failed} failed${c.reset}`
	);

	if (failed > 0) Deno.exit(1);
}
