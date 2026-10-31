import { spawn } from 'node:child_process';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import process from 'node:process';
import { createInterface } from 'node:readline/promises';
import { isNotFound } from '#utils/fs.ts';

const versionPattern = /^v\d+\.\d+\.\d+$/;

const APP_IMAGE = 'profilarr:alpine';
const IMAGES = [APP_IMAGE, 'profilarr-parser:alpine'];

/** The parts of Trivy's JSON report the npm summary reads */
interface TrivyVulnerability {
	VulnerabilityID: string;
	PkgName: string;
	InstalledVersion: string;
	FixedVersion?: string;
	Severity: string;
}

interface TrivyReport {
	Results?: {
		Type?: string;
		Packages?: unknown[];
		Vulnerabilities?: TrivyVulnerability[];
	}[];
}

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

/** Runs Trivy on an image's language packages and returns its JSON report */
async function scanLibraries(image: string): Promise<TrivyReport> {
	const dir = await mkdtemp(join(tmpdir(), 'profilarr-trivy-'));
	const output = join(dir, 'libraries.json');
	try {
		await run('trivy', [
			'image',
			'--quiet',
			'--pkg-types',
			'library',
			'--list-all-pkgs',
			'--format',
			'json',
			'--output',
			output,
			image
		]);
		return JSON.parse(await readFile(output, 'utf8')) as TrivyReport;
	} finally {
		await rm(dir, { recursive: true, force: true });
	}
}

/**
 * Lists the npm findings in the app image without blocking the release.
 * Vite bundles the npm packages into the server, so Trivy reads them from the
 * image's SBOM, and Dependabot alerts track them from the lockfile. Trivy skips
 * an SBOM it can't read without a warning, so an empty package list stops the
 * release.
 */
async function reportNpmPackages(image: string): Promise<void> {
	const report = await scanLibraries(image);
	const npm = (report.Results ?? []).filter((result) => result.Type === 'node-pkg');
	const packages = npm.reduce((count, result) => count + (result.Packages?.length ?? 0), 0);
	if (packages === 0) {
		console.error(
			`Trivy found no npm packages in ${image}. Check that the image still ships a CycloneDX SBOM Trivy can read.`
		);
		process.exit(1);
	}

	const findings = npm.flatMap((result) => result.Vulnerabilities ?? []);
	console.log(`${image}: ${packages} npm packages, ${findings.length} known vulnerabilities`);
	for (const finding of findings) {
		const fixed = finding.FixedVersion || 'no fix';
		console.log(
			`  ${finding.Severity.padEnd(8)} ${finding.PkgName}@${finding.InstalledVersion} ${finding.VulnerabilityID} (${fixed})`
		);
	}
}

async function scanImages() {
	console.log('\nScanning images for CVEs...\n');
	for (const image of IMAGES) {
		console.log(`Scanning ${image}...`);
		if (image === APP_IMAGE) {
			// OS packages block the release; npm findings are only listed
			await run('trivy', [
				'image',
				'--pkg-types',
				'os',
				'--severity',
				'CRITICAL,HIGH',
				'--exit-code',
				'1',
				image
			]);
			await reportNpmPackages(image);
		} else {
			await run('trivy', ['image', '--severity', 'CRITICAL,HIGH', '--exit-code', '1', image]);
		}
		console.log(`${image}: passed\n`);
	}
}

if (import.meta.main) {
	const [mode, version, notesPath] = process.argv.slice(2);

	if (mode === 'scan') {
		await buildImages();
		await scanImages();
		console.log('All image scans passed.');
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
