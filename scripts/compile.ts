const TARGETS: Record<string, { denoTarget: string; binary: string }> = {
	'windows-amd64': {
		denoTarget: 'x86_64-pc-windows-msvc',
		binary: 'profilarr.exe'
	},
	'linux-amd64': {
		denoTarget: 'x86_64-unknown-linux-gnu',
		binary: 'profilarr'
	},
	'linux-arm64': {
		denoTarget: 'aarch64-unknown-linux-gnu',
		binary: 'profilarr'
	},
	'macos-amd64': {
		denoTarget: 'x86_64-apple-darwin',
		binary: 'profilarr'
	},
	'macos-arm64': {
		denoTarget: 'aarch64-apple-darwin',
		binary: 'profilarr'
	}
};

const COMPILE_FLAGS = [
	'--no-check',
	'--allow-net',
	'--allow-read',
	'--allow-write',
	'--allow-env',
	'--allow-ffi',
	'--allow-run',
	'--allow-sys'
];

const BUILD_DIR = 'dist/build';
const ENTRY = `${BUILD_DIR}/mod.ts`;

function usage(): never {
	const names = Object.keys(TARGETS).join(', ');
	console.error('Usage:');
	console.error(`  deno task compile <${names} | all>`);
	Deno.exit(1);
}

function timestamp(): string {
	const d = new Date();
	const pad = (n: number) => String(n).padStart(2, '0');
	return (
		`${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
		`-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
	);
}

async function run(command: string, args: string[], opts?: { cwd?: string }): Promise<boolean> {
	try {
		const status = await new Deno.Command(command, {
			args,
			cwd: opts?.cwd,
			stdout: 'inherit',
			stderr: 'inherit'
		}).output();
		return status.success;
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			console.error(`${command} was not found on PATH.`);
			Deno.exit(127);
		}
		throw error;
	}
}

async function compile(platform: string): Promise<string | null> {
	const target = TARGETS[platform];
	if (!target) {
		console.error(`Unknown platform: ${platform}`);
		return null;
	}

	const outputPath = `${BUILD_DIR}/${target.binary}`;

	console.log(`\nCompiling for ${platform} (${target.denoTarget})...`);

	const ok = await run('deno', [
		'compile',
		...COMPILE_FLAGS,
		'--target',
		target.denoTarget,
		'--output',
		outputPath,
		ENTRY
	]);

	if (!ok) {
		console.error(`Compile failed for ${platform}.`);
		return null;
	}

	const ts = timestamp();
	const zipName = `profilarr-${platform}-${ts}.zip`;
	const absZip = `${Deno.cwd()}/dist/${zipName}`;

	console.log(`Packaging ${zipName}...`);

	const ok2 = await run('zip', ['-j', absZip, target.binary, 'server.js'], {
		cwd: BUILD_DIR
	});

	if (!ok2) {
		console.error(`Zip failed for ${platform}.`);
		return null;
	}

	const ok3 = await run('zip', ['-r', absZip, 'static'], { cwd: BUILD_DIR });

	if (!ok3) {
		console.error(`Zip (static) failed for ${platform}.`);
		return null;
	}

	// Clean up the binary
	try {
		await Deno.remove(outputPath);
	} catch {
		// fine if it doesn't exist
	}

	const zipPath = `dist/${zipName}`;
	const stat = await Deno.stat(absZip);
	const mb = (stat.size / 1024 / 1024).toFixed(1);
	console.log(`  -> ${zipPath} (${mb} MB)`);

	return zipPath;
}

// --- main ---

const arg = Deno.args[0];
if (!arg) usage();

// Check that the Vite build exists
try {
	await Deno.stat(`${BUILD_DIR}/server.js`);
	await Deno.stat(`${BUILD_DIR}/static`);
} catch {
	console.error(`${BUILD_DIR}/server.js or ${BUILD_DIR}/static not found.`);
	console.error('Run the Vite build first: APP_BASE_PATH=./dist/build deno run -A npm:vite build');
	Deno.exit(1);
}

const platforms = arg === 'all' ? Object.keys(TARGETS) : [arg];

for (const p of platforms) {
	if (!TARGETS[p]) {
		console.error(`Unknown platform: ${p}. Options: ${Object.keys(TARGETS).join(', ')}, all`);
		Deno.exit(1);
	}
}

const results: string[] = [];

for (const p of platforms) {
	const path = await compile(p);
	if (path) results.push(path);
}

console.log(`\nDone. ${results.length}/${platforms.length} succeeded.`);
for (const r of results) console.log(`  ${r}`);
