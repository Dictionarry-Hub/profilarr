import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { isNotFound } from '#utils/fs.ts';

const versionPattern = /^v\d+\.\d+\.\d+$/;

const IMAGES = ['profilarr:alpine', 'profilarr-parser:alpine'];

function usage(): never {
	console.error('Usage:');
	console.error('  pnpm release:dry v2.6.0 [notes.md]');
	console.error('  pnpm release:scan');
	console.error('  pnpm release v2.6.0 [notes.md]');
	process.exit(1);
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
export async function readNotes(path: string | undefined): Promise<string | null> {
	if (!path) {
		return null;
	}

	let text: string;
	try {
		text = (await readFile(path, 'utf8')).trim();
	} catch (error) {
		if (isNotFound(error)) {
			// eslint-disable-next-line preserve-caught-error -- FIXME: pass the caught error as `cause`
			throw new Error(`Release notes file ${path} was not found.`);
		}

		throw error;
	}

	if (!text) {
		throw new Error(`Release notes file ${path} is empty.`);
	}

	return text;
}

export function cliffArgs(tag: string, notes: string | null): string[] {
	const args = ['--config', 'cliff.toml', '--unreleased', '--tag', tag];
	return notes ? [...args, '--with-tag-message', notes] : args;
}

export function tagArgs(tag: string, notes: string | null): string[] {
	// The default strip cleanup drops lines starting with #, including markdown headings
	return notes ? ['tag', '-a', '--cleanup=whitespace', '-m', notes, tag] : ['tag', tag];
}

async function readNotesOrExit(path: string | undefined): Promise<string | null> {
	try {
		return await readNotes(path);
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}

function run(command: string, args: string[]): Promise<void> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { stdio: 'inherit' });

		child.on('error', (error) => {
			if (isNotFound(error)) {
				console.error(`${command} was not found on PATH. Install it before running a release.`);
				process.exit(127);
			}

			reject(error);
		});

		child.on('close', (code) => {
			if (code !== 0) {
				process.exit(code ?? 1);
			}

			resolve();
		});
	});
}

/** Asks on the terminal; null when stdin closes without an answer. */
async function ask(question: string): Promise<string | null> {
	const terminal = createInterface({ input: process.stdin, output: process.stdout });
	const closed = new Promise<null>((resolve) => terminal.once('close', () => resolve(null)));
	try {
		return await Promise.race([terminal.question(`${question} `), closed]);
	} finally {
		terminal.close();
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

if (import.meta.main) {
	const [mode, version, notesPath] = process.argv.slice(2);

	if (mode === 'scan') {
		await buildImages();
		await scanImages();
		console.log('All images clean.');
	} else if (mode === 'dry') {
		const tag = assertVersion(version);
		const notes = await readNotesOrExit(notesPath);
		await run('git-cliff', cliffArgs(tag, notes));
	} else if (mode === 'tag') {
		const tag = assertVersion(version);
		// Read before the slow image build so a bad path fails fast
		const notes = await readNotesOrExit(notesPath);
		await buildImages();
		await scanImages();

		const kind = notes
			? `annotated tag ${tag} with notes from ${notesPath}`
			: `plain tag ${tag} (no release notes)`;
		const answer = await ask(`Create and push ${kind}? Type ${tag} to confirm:`);

		if (answer !== tag) {
			console.error('Release cancelled.');
			process.exit(1);
		}

		await run('git', tagArgs(tag, notes));
		await run('git', ['push', 'origin', tag]);
	} else {
		usage();
	}
}
