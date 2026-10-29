/**
 * Toolchain drift lint script
 *
 * `.tool-versions` is the source of truth for runtime versions. CI and Docker
 * should read from it directly where possible, or use defaults that are checked
 * against it where Docker syntax requires a literal fallback.
 *
 * Usage:
 *   pnpm lint:toolchain
 */

import { readFile } from 'node:fs/promises';
import process from 'node:process';

const TOOL_VERSIONS_PATH = '.tool-versions';
const DOCKERFILE_PATH = 'Dockerfile';
const CI_PATH = '.github/workflows/ci.yml';
const SETUP_ACTION_PATH = '.github/actions/setup/action.yml';

interface ToolVersions {
	deno?: string;
	nodejs?: string;
	pnpm?: string;
}

function parseToolVersions(source: string): ToolVersions {
	const versions: ToolVersions = {};

	for (const rawLine of source.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const [tool, version] = line.split(/\s+/, 2);
		if (tool === 'deno') versions.deno = version;
		if (tool === 'nodejs') versions.nodejs = version;
		if (tool === 'pnpm') versions.pnpm = version;
	}

	return versions;
}

function matchCount(source: string, pattern: RegExp): number {
	return Array.from(source.matchAll(pattern)).length;
}

function escapeRegExp(source: string): string {
	return source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function actionUseCount(source: string, action: string, major: string): number {
	const escapedAction = escapeRegExp(action);
	const escapedMajor = escapeRegExp(major);
	const pattern = new RegExp(
		`uses:\\s+${escapedAction}@(?:${escapedMajor}|[0-9a-f]{40}\\s+#\\s+${escapedMajor}(?:\\.\\d+){0,2})(?:\\s|$)`,
		'g'
	);

	return matchCount(source, pattern);
}

function requireTool(
	versions: ToolVersions,
	tool: keyof ToolVersions,
	violations: string[]
): string {
	const version = versions[tool];
	if (!version) {
		violations.push(`${TOOL_VERSIONS_PATH} is missing ${tool}`);
		return '';
	}
	return version;
}

function checkDockerArg(
	source: string,
	name: string,
	expected: string,
	violations: string[]
): void {
	const dockerArg = new RegExp(`^ARG ${name}=(.+)$`, 'm').exec(source)?.[1];
	if (dockerArg !== expected) {
		violations.push(
			`${DOCKERFILE_PATH} ${name} is ${dockerArg ?? 'missing'}, expected ${expected}`
		);
	}
}

function checkDockerfile(source: string, versions: ToolVersions, violations: string[]): void {
	checkDockerArg(source, 'DENO_VERSION', versions.deno ?? '', violations);
	checkDockerArg(source, 'NODE_VERSION', versions.nodejs ?? '', violations);
	checkDockerArg(source, 'PNPM_VERSION', versions.pnpm ?? '', violations);

	if (!source.includes('FROM node:${NODE_VERSION}-bookworm-slim AS builder')) {
		violations.push(`${DOCKERFILE_PATH} builder image must use NODE_VERSION`);
	}

	if (!source.includes('FROM denoland/deno:bin-${DENO_VERSION} AS deno')) {
		violations.push(`${DOCKERFILE_PATH} Deno binary stage must use DENO_VERSION`);
	}

	if (!source.includes('FROM denoland/deno:alpine-${DENO_VERSION}')) {
		violations.push(`${DOCKERFILE_PATH} runtime image must use DENO_VERSION`);
	}
}

function checkNodeSetup(source: string, path: string, violations: string[]): void {
	const nodeSetups = actionUseCount(source, 'actions/setup-node', 'v7');
	const nodeVersionFiles = matchCount(source, /node-version-file:\s+\.tool-versions/g);
	if (nodeSetups !== nodeVersionFiles) {
		violations.push(
			`${path} has ${nodeSetups} Node setup steps but ${nodeVersionFiles} use .tool-versions`
		);
	}

	if (/\bnode-version:\s/.test(source)) {
		violations.push(`${path} must use node-version-file, not node-version`);
	}
}

function checkCi(source: string, violations: string[]): void {
	// Only the build job needs Deno, to compile the binary
	const denoSetups = actionUseCount(source, 'denoland/setup-deno', 'v2');
	if (denoSetups !== 1) {
		violations.push(`${CI_PATH} has ${denoSetups} Deno setup steps, expected 1 (build)`);
	}

	const denoVersionFiles = matchCount(source, /deno-version-file:\s+\.tool-versions/g);
	if (denoSetups !== denoVersionFiles) {
		violations.push(
			`${CI_PATH} has ${denoSetups} Deno setup steps but ${denoVersionFiles} use .tool-versions`
		);
	}

	if (/\bdeno-version:\s/.test(source)) {
		violations.push(`${CI_PATH} must use deno-version-file, not deno-version`);
	}

	checkNodeSetup(source, CI_PATH, violations);
}

function checkSetupAction(source: string, violations: string[]): void {
	if (actionUseCount(source, 'actions/setup-node', 'v7') === 0) {
		violations.push(`${SETUP_ACTION_PATH} must set up Node with actions/setup-node`);
	}

	checkNodeSetup(source, SETUP_ACTION_PATH, violations);

	if (actionUseCount(source, 'pnpm/action-setup', 'v6') === 0) {
		violations.push(`${SETUP_ACTION_PATH} must set up pnpm with pnpm/action-setup`);
	}

	// The pnpm version is read from .tool-versions in an earlier step
	if (/\bversion:\s*['"]?\d/.test(source)) {
		violations.push(`${SETUP_ACTION_PATH} must read the pnpm version from .tool-versions`);
	}
}

const [toolVersionsSource, dockerfileSource, ciSource, setupActionSource] = await Promise.all([
	readFile(TOOL_VERSIONS_PATH, 'utf8'),
	readFile(DOCKERFILE_PATH, 'utf8'),
	readFile(CI_PATH, 'utf8'),
	readFile(SETUP_ACTION_PATH, 'utf8')
]);

const violations: string[] = [];
const versions = parseToolVersions(toolVersionsSource);
for (const tool of ['deno', 'nodejs', 'pnpm'] as const) {
	const version = requireTool(versions, tool, violations);
	if (version && !/^\d+\.\d+\.\d+$/.test(version)) {
		violations.push(`${TOOL_VERSIONS_PATH} ${tool} must be an exact version`);
	}
}

checkDockerfile(dockerfileSource, versions, violations);
checkCi(ciSource, violations);
checkSetupAction(setupActionSource, violations);

if (violations.length > 0) {
	console.error('Toolchain drift detected:');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	process.exit(1);
}
