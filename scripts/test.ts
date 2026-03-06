/**
 * Test runner script that allows running specific test files or directories
 *
 * Usage:
 *   deno task test              # Run all tests
 *   deno task test filters      # Run src/tests/upgrades/filters.test.ts
 *   deno task test upgrades     # Run all tests in src/tests/upgrades/
 *   deno task test logger       # Run all tests in src/tests/logger/
 */

const aliases: Record<string, string> = {
	// Individual test files
	filters: 'src/tests/upgrades/filters.test.ts',
	normalize: 'src/tests/upgrades/normalize.test.ts',
	selectors: 'src/tests/upgrades/selectors.test.ts',
	backup: 'src/tests/jobs/createBackup.test.ts',
	cleanup: 'src/tests/logger/cleanupLogs.test.ts',
	processor: 'src/tests/rename/processor.test.ts',

	// Directories
	upgrades: 'src/tests/upgrades',
	jobs: 'src/tests/jobs',
	logger: 'src/tests/logger',
	rename: 'src/tests/rename',
	auth: 'src/tests/auth',
	integration: 'src/tests/integration/specs'
};

// Get the test target from args
const target = Deno.args[0];
const testPath = target ? (aliases[target] ?? target) : 'src/tests';

// Check if it's a valid path
if (target && !aliases[target]) {
	// Check if it's a direct path
	try {
		await Deno.stat(target);
	} catch {
		console.error(`Unknown test target: "${target}"`);
		console.error('\nAvailable aliases:');
		for (const [alias, path] of Object.entries(aliases)) {
			console.error(`  ${alias.padEnd(12)} -> ${path}`);
		}
		Deno.exit(1);
	}
}

console.log(`Running tests: ${testPath}\n`);

const cmd = new Deno.Command('deno', {
	args: ['test', testPath, '--allow-read', '--allow-write', '--allow-env', '--allow-run'],
	env: {
		...Deno.env.toObject(),
		APP_BASE_PATH: './dist/test'
	},
	stdout: 'inherit',
	stderr: 'inherit'
});

const { code } = await cmd.output();
Deno.exit(code);
