const mode = Deno.args[0];
const version = Deno.args[1];
const versionPattern = /^v\d+\.\d+\.\d+$/;

const IMAGES = ['profilarr:alpine', 'profilarr-parser:alpine'];

function usage(): never {
	console.error('Usage:');
	console.error('  deno task release:dry v2.6.0');
	console.error('  deno task release:scan');
	console.error('  deno task release v2.6.0');
	Deno.exit(1);
}

function assertVersion(value: string | undefined): string {
	if (!value || !versionPattern.test(value)) {
		console.error('Version must look like v2.6.0.');
		usage();
	}

	return value;
}

async function run(command: string, args: string[]) {
	try {
		const status = await new Deno.Command(command, {
			args,
			stdout: 'inherit',
			stderr: 'inherit'
		}).output();

		if (!status.success) {
			Deno.exit(status.code);
		}
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			console.error(`${command} was not found on PATH. Install it before running a release.`);
			Deno.exit(127);
		}

		throw error;
	}
}

async function buildImages() {
	console.log('\nBuilding images...\n');
	await run('docker', ['compose', '-f', 'compose.yml', '-f', 'compose.dev.yml', 'build']);
}

async function scanImages() {
	console.log('\nScanning images for CVEs...\n');
	for (const image of IMAGES) {
		console.log(`Scanning ${image}...`);
		await run('trivy', ['image', '--severity', 'CRITICAL,HIGH', '--exit-code', '1', image]);
		console.log(`${image}: clean\n`);
	}
}

if (mode === 'scan') {
	await buildImages();
	await scanImages();
	console.log('All images clean.');
} else if (mode === 'dry') {
	const tag = assertVersion(version);
	await run('git-cliff', ['--config', 'cliff.toml', '--unreleased', '--tag', tag]);
} else if (mode === 'tag') {
	const tag = assertVersion(version);
	await buildImages();
	await scanImages();

	const answer = prompt(`Create and push release tag ${tag}? Type ${tag} to confirm:`);

	if (answer !== tag) {
		console.error('Release cancelled.');
		Deno.exit(1);
	}

	await run('git', ['tag', tag]);
	await run('git', ['push', 'origin', tag]);
} else {
	usage();
}
