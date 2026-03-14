/**
 * PCD Dependency Resolution
 * Handles cloning and managing PCD dependencies using git tags
 */

import { checkout, clone, fetchTags } from '$utils/git/index.ts';
import { loadManifest } from '../manifest/manifest.ts';
import { logger } from '$logger/logger.ts';

export interface DependencySyncResult {
	changed: boolean;
	repositories: string[];
}

/**
 * Extract repository name from GitHub URL
 * https://github.com/Dictionarry-Hub/schema -> schema
 */
function getRepoName(repoUrl: string): string {
	const parts = repoUrl.split('/');
	return parts[parts.length - 1];
}

/**
 * Get dependency path
 */
function getDependencyPath(pcdPath: string, repoName: string): string {
	return `${pcdPath}/deps/${repoName}`;
}

/**
 * Check if a directory exists
 */
async function dirExists(path: string): Promise<boolean> {
	try {
		const stat = await Deno.stat(path);
		return stat.isDirectory;
	} catch {
		return false;
	}
}

/**
 * Clone and checkout a dependency at a specific tag
 * Keeps .git, ops, and pcd.json - removes everything else
 */
async function cloneDependency(
	pcdPath: string,
	repoUrl: string,
	version: string,
	personalAccessToken?: string
): Promise<void> {
	const repoName = getRepoName(repoUrl);
	const depPath = getDependencyPath(pcdPath, repoName);

	// Clone the dependency repository
	await clone(repoUrl, depPath, undefined, personalAccessToken);

	// Checkout the specific version tag
	await checkout(depPath, version);

	// Clean up dependency - keep only .git, ops folder and pcd.json
	const keepItems = new Set(['.git', 'ops', 'pcd.json']);

	for await (const entry of Deno.readDir(depPath)) {
		if (!keepItems.has(entry.name)) {
			const itemPath = `${depPath}/${entry.name}`;
			await Deno.remove(itemPath, { recursive: true });
		}
	}
}

/**
 * Get the installed version of a dependency from its manifest
 */
async function getInstalledVersion(pcdPath: string, repoName: string): Promise<string | null> {
	const depManifestPath = `${pcdPath}/deps/${repoName}/pcd.json`;
	try {
		const content = await Deno.readTextFile(depManifestPath);
		const manifest = JSON.parse(content);
		return manifest.version ?? null;
	} catch {
		return null;
	}
}

/**
 * Update a dependency to a new version using fetch + checkout
 */
async function updateDependency(depPath: string, version: string): Promise<void> {
	await fetchTags(depPath);
	await checkout(depPath, version);
}

/**
 * Process all dependencies for a PCD (initial clone)
 * Called when linking a new database
 */
export async function processDependencies(
	pcdPath: string,
	personalAccessToken?: string
): Promise<void> {
	const manifest = await loadManifest(pcdPath);

	if (!manifest.dependencies || Object.keys(manifest.dependencies).length === 0) {
		return;
	}

	// Create deps directory
	const depsDir = `${pcdPath}/deps`;
	await Deno.mkdir(depsDir, { recursive: true });

	for (const [repoUrl, version] of Object.entries(manifest.dependencies)) {
		const repoName = getRepoName(repoUrl);
		const depPath = getDependencyPath(pcdPath, repoName);

		// Clone and checkout the dependency
		await cloneDependency(pcdPath, repoUrl, version, personalAccessToken);

		// Validate the dependency's manifest
		await loadManifest(depPath);

		await logger.debug(`Installed dependency ${repoName}@${version}`, {
			source: 'PCDDependencies',
			meta: { pcdPath, repoName, version }
		});
	}
}

/**
 * Sync dependencies - update any that have changed versions
 * Uses fetch + checkout instead of re-cloning
 */
export async function syncDependencies(
	pcdPath: string,
	personalAccessToken?: string
): Promise<DependencySyncResult> {
	const manifest = await loadManifest(pcdPath);

	if (!manifest.dependencies || Object.keys(manifest.dependencies).length === 0) {
		return { changed: false, repositories: [] };
	}

	const depsDir = `${pcdPath}/deps`;
	await Deno.mkdir(depsDir, { recursive: true });
	const changedRepositories: string[] = [];

	for (const [repoUrl, requiredVersion] of Object.entries(manifest.dependencies)) {
		const repoName = getRepoName(repoUrl);
		const depPath = getDependencyPath(pcdPath, repoName);
		const installedVersion = await getInstalledVersion(pcdPath, repoName);

		// Already at correct version
		if (installedVersion === requiredVersion) {
			continue;
		}

		// Check if dependency exists with .git folder
		const hasGitFolder = await dirExists(`${depPath}/.git`);

		if (hasGitFolder) {
			// Fetch tags and checkout new version
			await updateDependency(depPath, requiredVersion);
			await logger.info(
				`Updated dependency ${repoName}: ${installedVersion} -> ${requiredVersion}`,
				{
					source: 'PCDDependencies',
					meta: { pcdPath, repoName, from: installedVersion, to: requiredVersion }
				}
			);
			changedRepositories.push(repoName);
		} else {
			// No .git folder (legacy or corrupted) - re-clone
			try {
				await Deno.remove(depPath, { recursive: true });
			} catch {
				// Didn't exist
			}
			await cloneDependency(pcdPath, repoUrl, requiredVersion, personalAccessToken);
			await logger.info(`Re-cloned dependency ${repoName}@${requiredVersion}`, {
				source: 'PCDDependencies',
				meta: { pcdPath, repoName, version: requiredVersion }
			});
			changedRepositories.push(repoName);
		}

		// Validate the dependency's manifest
		await loadManifest(depPath);
	}

	return {
		changed: changedRepositories.length > 0,
		repositories: changedRepositories
	};
}

/**
 * Validate and fix dependencies on startup
 * Ensures all deps exist and are at the correct version
 */
export async function validateDependencies(
	pcdPath: string,
	personalAccessToken?: string
): Promise<boolean> {
	try {
		const manifest = await loadManifest(pcdPath);

		if (!manifest.dependencies || Object.keys(manifest.dependencies).length === 0) {
			return true;
		}

		let allValid = true;

		for (const [repoUrl, requiredVersion] of Object.entries(manifest.dependencies)) {
			const repoName = getRepoName(repoUrl);
			const depPath = getDependencyPath(pcdPath, repoName);

			// Check if dependency exists
			if (!(await dirExists(depPath))) {
				await logger.warn(`Missing dependency ${repoName}, will install`, {
					source: 'PCDDependencies',
					meta: { pcdPath, repoName }
				});
				allValid = false;
				continue;
			}

			// Check version
			const installedVersion = await getInstalledVersion(pcdPath, repoName);
			if (installedVersion !== requiredVersion) {
				await logger.warn(
					`Dependency ${repoName} version mismatch: ${installedVersion} != ${requiredVersion}`,
					{
						source: 'PCDDependencies',
						meta: { pcdPath, repoName, installed: installedVersion, required: requiredVersion }
					}
				);
				allValid = false;
			}

			// Validate manifest
			try {
				await loadManifest(depPath);
			} catch {
				await logger.warn(`Dependency ${repoName} has invalid manifest`, {
					source: 'PCDDependencies',
					meta: { pcdPath, repoName }
				});
				allValid = false;
			}
		}

		// If any issues found, run sync to fix them
		if (!allValid) {
			await syncDependencies(pcdPath, personalAccessToken);
		}

		return true;
	} catch (error) {
		await logger.error('Failed to validate dependencies', {
			source: 'PCDDependencies',
			meta: { pcdPath, error: String(error) }
		});
		return false;
	}
}
