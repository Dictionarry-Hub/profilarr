const mode = Deno.args[0];
const version = Deno.args[1];
const versionPattern = /^v\d+\.\d+\.\d+$/;

function usage(): never {
	console.error('Usage:');
	console.error('  deno task release:dry v2.6.0');
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
			console.error(`${command} was not found on PATH.`);
			Deno.exit(127);
		}

		throw error;
	}
}

const tag = assertVersion(version);

if (mode === 'dry') {
	await run('git-cliff', ['--config', 'cliff.toml', '--unreleased', '--tag', tag]);
} else if (mode === 'tag') {
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
