const mode = Deno.args[0];
const version = Deno.args[1];
const notesPath = Deno.args[2];
const versionPattern = /^v\d+\.\d+\.\d+$/;

const IMAGES = ['profilarr:alpine', 'profilarr-parser:alpine'];

function usage(): never {
	console.error('Usage:');
	console.error('  deno task release:dry v2.6.0 [notes.md]');
	console.error('  deno task release:scan');
	console.error('  deno task release v2.6.0 [notes.md]');
	Deno.exit(1);
}

function assertVersion(value: string | undefined): string {
	if (!value || !versionPattern.test(value)) {
		console.error('Version must look like v2.6.0.');
		usage();
	}

	return value;
}

/**
 * Reads the optional release notes intro. It becomes the annotated tag message,
 * which git-cliff renders above the generated changelog.
 */
async function readNotes(path: string | undefined): Promise<string | null> {
	if (!path) {
		return null;
	}

	let text: string;
	try {
		text = (await Deno.readTextFile(path)).trim();
	} catch (error) {
		if (error instanceof Deno.errors.NotFound) {
			console.error(`Release notes file ${path} was not found.`);
			Deno.exit(1);
		}

		throw error;
	}

	if (!text) {
		console.error(`Release notes file ${path} is empty.`);
		Deno.exit(1);
	}

	return text;
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
	const notes = await readNotes(notesPath);
	const args = ['--config', 'cliff.toml', '--unreleased', '--tag', tag];

	if (notes) {
		args.push('--with-tag-message', notes);
	}

	await run('git-cliff', args);
} else if (mode === 'tag') {
	const tag = assertVersion(version);
	// Read before the slow image build so a bad path fails fast
	const notes = await readNotes(notesPath);
	await buildImages();
	await scanImages();

	const kind = notes
		? `annotated tag ${tag} with notes from ${notesPath}`
		: `plain tag ${tag} (no release notes)`;
	const answer = prompt(`Create and push ${kind}? Type ${tag} to confirm:`);

	if (answer !== tag) {
		console.error('Release cancelled.');
		Deno.exit(1);
	}

	if (notes) {
		// The default strip cleanup drops lines starting with #, including markdown headings
		await run('git', ['tag', '-a', '--cleanup=whitespace', '-m', notes, tag]);
	} else {
		await run('git', ['tag', tag]);
	}

	await run('git', ['push', 'origin', tag]);
} else {
	usage();
}
