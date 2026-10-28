/**
 * Toolchain drift lint script
 *
 * `.tool-versions` is the source of truth for runtime versions. CI and Docker
 * should read from it directly where possible, or use defaults that are checked
 * against it where Docker syntax requires a literal fallback.
 *
 * Usage:
 *   deno task lint:toolchain
 */

const TOOL_VERSIONS_PATH = '.tool-versions';
const DOCKERFILE_PATH = 'Dockerfile';
const CI_PATH = '.github/workflows/ci.yml';

interface ToolVersions {
	deno?: string;
	nodejs?: string;
}

function parseToolVersions(source: string): ToolVersions {
	const versions: ToolVersions = {};

	for (const rawLine of source.split('\n')) {
		const line = rawLine.trim();
		if (!line || line.startsWith('#')) continue;

		const [tool, version] = line.split(/\s+/, 2);
		if (tool === 'deno') versions.deno = version;
		if (tool === 'nodejs') versions.nodejs = version;
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

function checkDockerfile(source: string, denoVersion: string, violations: string[]): void {
	const dockerArg = /^ARG DENO_VERSION=(.+)$/m.exec(source)?.[1];
	if (dockerArg !== denoVersion) {
		violations.push(
			`${DOCKERFILE_PATH} DENO_VERSION is ${dockerArg ?? 'missing'}, expected ${denoVersion}`
		);
	}

	if (!source.includes('FROM denoland/deno:${DENO_VERSION} AS builder')) {
		violations.push(`${DOCKERFILE_PATH} builder image must use DENO_VERSION`);
	}

	if (!source.includes('FROM denoland/deno:alpine-${DENO_VERSION}')) {
		violations.push(`${DOCKERFILE_PATH} runtime image must use DENO_VERSION`);
	}
}

function checkCi(source: string, violations: string[]): void {
	const denoSetups = actionUseCount(source, 'denoland/setup-deno', 'v2');
	const denoVersionFiles = matchCount(source, /deno-version-file:\s+\.tool-versions/g);
	if (denoSetups !== denoVersionFiles) {
		violations.push(
			`${CI_PATH} has ${denoSetups} Deno setup steps but ${denoVersionFiles} use .tool-versions`
		);
	}

	if (/\bdeno-version:\s/.test(source)) {
		violations.push(`${CI_PATH} must use deno-version-file, not deno-version`);
	}

	const nodeSetups = actionUseCount(source, 'actions/setup-node', 'v7');
	const nodeVersionFiles = matchCount(source, /node-version-file:\s+\.tool-versions/g);
	if (nodeSetups !== nodeVersionFiles) {
		violations.push(
			`${CI_PATH} has ${nodeSetups} Node setup steps but ${nodeVersionFiles} use .tool-versions`
		);
	}

	if (/\bnode-version:\s/.test(source)) {
		violations.push(`${CI_PATH} must use node-version-file, not node-version`);
	}
}

const [toolVersionsSource, dockerfileSource, ciSource] = await Promise.all([
	Deno.readTextFile(TOOL_VERSIONS_PATH),
	Deno.readTextFile(DOCKERFILE_PATH),
	Deno.readTextFile(CI_PATH)
]);

const violations: string[] = [];
const versions = parseToolVersions(toolVersionsSource);
const denoVersion = requireTool(versions, 'deno', violations);
requireTool(versions, 'nodejs', violations);

if (denoVersion && !/^\d+\.\d+\.\d+$/.test(denoVersion)) {
	violations.push(`${TOOL_VERSIONS_PATH} deno must be an exact version`);
}

checkDockerfile(dockerfileSource, denoVersion, violations);
checkCi(ciSource, violations);

if (violations.length > 0) {
	console.error('Toolchain drift detected:');
	for (const violation of violations) {
		console.error(`- ${violation}`);
	}
	Deno.exit(1);
}
