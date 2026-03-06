/**
 * Integration test orchestrator.
 *
 * 1. Start Docker Compose if needed (mock-oauth2-server + Caddy)
 * 2. Run integration test specs (each spec gets its own port, all run in parallel)
 * 3. Tear down Docker + clean up temp directories
 *
 * Usage:
 *   deno task test:integration              # Run all (in parallel)
 *   deno task test:integration health       # Run specific spec
 */

const COMPOSE_FILE = 'src/tests/integration/docker-compose.yml';
const SPEC_DIR = 'src/tests/integration/specs';

// Specs that require Docker infrastructure (mock-oauth2-server, Caddy)
const needsDocker = new Set(['oidc', 'cookie', 'proxy']);

// Specs that connect to Caddy's self-signed TLS
const needsTlsInsecure = new Set(['cookie', 'proxy', 'oidc']);

const target = Deno.args[0];
const testPath = target ? `${SPEC_DIR}/${target}.test.ts` : SPEC_DIR;

// Validate target exists if specified
if (target) {
	try {
		await Deno.stat(testPath);
	} catch {
		console.error(`Unknown test target: "${target}"`);
		console.error(`Expected file: ${testPath}`);
		Deno.exit(1);
	}
}

// Docker is needed when running all specs or a spec that requires it
const dockerRequired = !target || needsDocker.has(target);

let exitCode = 1;

try {
	if (dockerRequired) {
		console.log('Starting Docker infrastructure...');
		await run('docker', ['compose', '-f', COMPOSE_FILE, 'up', '-d', '--wait']);
		console.log('Docker infrastructure ready.\n');
	}

	// Collect spec files to run
	const specFiles: string[] = [];
	if (target) {
		specFiles.push(testPath);
	} else {
		for await (const entry of Deno.readDir(SPEC_DIR)) {
			if (entry.isFile && entry.name.endsWith('.test.ts')) {
				specFiles.push(`${SPEC_DIR}/${entry.name}`);
			}
		}
		specFiles.sort();
	}

	if (specFiles.length === 1) {
		// Single spec — run directly with inherited output
		console.log(`Running: ${specFiles[0]}\n`);
		const result = await runSpec(specFiles[0], 'inherit');
		exitCode = result.code;
	} else {
		// Multiple specs — run in parallel, collect output
		console.log(`Running ${specFiles.length} specs in parallel...\n`);
		const results = await Promise.all(specFiles.map((f) => runSpec(f, 'piped')));

		exitCode = 0;
		for (let i = 0; i < specFiles.length; i++) {
			const name = specFiles[i].replace(`${SPEC_DIR}/`, '').replace('.test.ts', '');
			const result = results[i];
			console.log(`\n${'═'.repeat(60)}`);
			console.log(` ${name}`);
			console.log(`${'═'.repeat(60)}`);
			console.log(result.stdout);
			if (result.stderr) console.error(result.stderr);
			if (result.code !== 0) exitCode = 1;
		}
	}
} catch (error) {
	console.error('Integration test error:', error);
} finally {
	if (dockerRequired) {
		console.log('\nStopping Docker infrastructure...');
		await run('docker', ['compose', '-f', COMPOSE_FILE, 'down']);
	}

	// Clean up temp directories
	console.log('Cleaning up temp directories...');
	try {
		for await (const entry of Deno.readDir('./dist')) {
			if (entry.isDirectory && entry.name.startsWith('integration-')) {
				try {
					await Deno.remove(`./dist/${entry.name}`, { recursive: true });
				} catch {
					// Ignore cleanup errors
				}
			}
		}
	} catch {
		// dist/ may not exist
	}
}

Deno.exit(exitCode);

async function runSpec(
	specFile: string,
	output: 'inherit' | 'piped'
): Promise<{ code: number; stdout: string; stderr: string }> {
	const specName = specFile.replace(`${SPEC_DIR}/`, '').replace('.test.ts', '');
	const args = ['run', '--allow-all', '--no-check'];
	if (needsTlsInsecure.has(specName)) {
		args.push('--unsafely-ignore-certificate-errors=localhost');
	}
	args.push(specFile);

	const cmd = new Deno.Command('deno', {
		args,
		env: {
			...Deno.env.toObject(),
			INTEGRATION_TEST: '1'
		},
		stdout: output,
		stderr: output
	});

	const result = await cmd.output();
	const decoder = new TextDecoder();
	return {
		code: result.code,
		stdout: output === 'piped' ? decoder.decode(result.stdout) : '',
		stderr: output === 'piped' ? decoder.decode(result.stderr) : ''
	};
}

async function run(cmd: string, args: string[]): Promise<void> {
	const command = new Deno.Command(cmd, {
		args,
		stdout: 'inherit',
		stderr: 'inherit'
	});
	const { code } = await command.output();
	if (code !== 0) {
		throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
	}
}
