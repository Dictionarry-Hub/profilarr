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
 *   pnpm scan:semgrep           Full scan
 *   pnpm scan:semgrep --quick   Local rules only
 */

import { spawn } from 'node:child_process';

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

/**
 * Run a command to completion and resolve with its exit code. A process killed
 * by a signal resolves as 1. Rejects if the command cannot be spawned.
 */
function run(command: string, args: string[], stdio: 'ignore' | 'inherit'): Promise<number> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio });
		child.on('error', reject);
		child.on('close', (code) => resolve(code ?? 1));
	});
}

const quick = process.argv.slice(2).includes('--quick');

// Check semgrep is installed
const checkCode = await run('semgrep', ['--version'], 'ignore').catch(() => 1);
if (checkCode !== 0) {
	console.error('semgrep is not installed. See https://semgrep.dev/docs/getting-started/');
	process.exit(1);
}

const configs = quick ? [LOCAL_CONFIG] : [LOCAL_CONFIG, ...COMMUNITY_CONFIGS];

const mode = quick ? 'quick (local rules only)' : 'full (local + community rules)';
console.log(`Running semgrep scan: ${mode}\n`);

const args = ['scan', ...configs.flatMap((c) => ['--config', c]), '--error', '--verbose'];

const code = await run('semgrep', args, 'inherit');
process.exit(code);
