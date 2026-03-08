/**
 * Semgrep static analysis scan.
 *
 * Modes:
 *   full (default)  Local rules + community rulesets (OWASP, Node, TS/JS, etc.)
 *   quick           Local rules only (.semgrep/)
 *
 * Requires: semgrep CLI installed
 *
 * Usage:
 *   deno task test semgrep           Full scan
 *   deno task test semgrep --quick   Local rules only
 */

const LOCAL_CONFIG = 'tests/scan/semgrep/';

const COMMUNITY_CONFIGS = [
	'p/default',
	'p/typescript',
	'p/javascript',
	'p/owasp-top-ten',
	'p/nodejs',
	'p/security-audit',
	'p/csharp'
];

const quick = Deno.args.includes('--quick');

// Check semgrep is installed
const check = new Deno.Command('semgrep', {
	args: ['--version'],
	stdout: 'null',
	stderr: 'null'
});
const { code: checkCode } = await check.output();
if (checkCode !== 0) {
	console.error('semgrep is not installed. See https://semgrep.dev/docs/getting-started/');
	Deno.exit(1);
}

const configs = quick ? [LOCAL_CONFIG] : [LOCAL_CONFIG, ...COMMUNITY_CONFIGS];

const mode = quick ? 'quick (local rules only)' : 'full (local + community rules)';
console.log(`Running semgrep scan: ${mode}\n`);

const args = ['scan', ...configs.flatMap((c) => ['--config', c]), '--error', '--verbose'];

const cmd = new Deno.Command('semgrep', {
	args,
	stdout: 'inherit',
	stderr: 'inherit'
});

const { code } = await cmd.output();
Deno.exit(code);
