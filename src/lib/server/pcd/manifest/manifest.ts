/**
 * PCD Manifest Parser and Validator
 * Handles reading and validating pcd.json files
 */

import * as fs from 'node:fs/promises';
import { logger } from '#logger/logger.ts';
import { ManifestValidationError } from '#pcd/core/errors.ts';
import { isNotFound } from '#utils/fs.ts';

export interface Manifest {
	name: string;
	version: string;
	description: string;
	dependencies?: Record<string, string>;
	arr_types?: string[];
	authors?: Array<{ name: string; email?: string }>;
	license?: string;
	repository?: string;
	tags?: string[];
	links?: {
		homepage?: string;
		documentation?: string;
		issues?: string;
	};
	profilarr: {
		minimum_version: string;
	};
}

/**
 * Read manifest from a PCD repository
 */
export async function readManifest(pcdPath: string): Promise<Manifest> {
	const manifestPath = `${pcdPath}/pcd.json`;

	try {
		const manifestContent = await fs.readFile(manifestPath, 'utf8');
		const manifest = JSON.parse(manifestContent);
		return manifest;
	} catch (error) {
		if (isNotFound(error)) {
			throw new ManifestValidationError('pcd.json not found in repository');
		}
		if (error instanceof SyntaxError) {
			throw new ManifestValidationError('pcd.json contains invalid JSON');
		}
		throw error;
	}
}

/**
 * Validate a manifest object
 */
export function validateManifest(manifest: unknown): asserts manifest is Manifest {
	if (!manifest || typeof manifest !== 'object') {
		throw new ManifestValidationError('Manifest must be an object');
	}

	const m = manifest as Record<string, unknown>;

	// Required fields
	if (typeof m.name !== 'string' || !m.name) {
		throw new ManifestValidationError('Manifest missing required field: name');
	}

	if (typeof m.version !== 'string' || !m.version) {
		throw new ManifestValidationError('Manifest missing required field: version');
	}

	if (typeof m.description !== 'string' || !m.description) {
		throw new ManifestValidationError('Manifest missing required field: description');
	}

	// Validate dependencies if present
	if (m.dependencies !== undefined) {
		if (typeof m.dependencies !== 'object' || m.dependencies === null) {
			throw new ManifestValidationError('Manifest field dependencies must be an object');
		}

		// Validate dependencies includes schema (only check for non-empty dependencies)
		const deps = m.dependencies as Record<string, unknown>;
		if (Object.keys(deps).length > 0) {
			const hasSchema = Object.keys(deps).some((url) => url.includes('/schema'));
			if (!hasSchema) {
				throw new ManifestValidationError('Manifest dependencies must include schema repository');
			}
		}
	}

	// Validate profilarr section
	if (!m.profilarr || typeof m.profilarr !== 'object') {
		throw new ManifestValidationError('Manifest missing required field: profilarr');
	}

	const profilarr = m.profilarr as Record<string, unknown>;
	if (typeof profilarr.minimum_version !== 'string' || !profilarr.minimum_version) {
		throw new ManifestValidationError('Manifest missing required field: profilarr.minimum_version');
	}

	// Optional fields validation
	if (m.arr_types !== undefined) {
		if (!Array.isArray(m.arr_types)) {
			throw new ManifestValidationError('Manifest field arr_types must be an array');
		}
		const validTypes = ['radarr', 'sonarr', 'readarr', 'lidarr', 'prowlarr', 'whisparr'];
		for (const type of m.arr_types) {
			if (typeof type !== 'string' || !validTypes.includes(type)) {
				throw new ManifestValidationError(
					`Invalid arr_type: ${type}. Must be one of: ${validTypes.join(', ')}`
				);
			}
		}
	}

	if (m.authors !== undefined) {
		if (!Array.isArray(m.authors)) {
			throw new ManifestValidationError('Manifest field authors must be an array');
		}
		for (const author of m.authors) {
			if (!author || typeof author !== 'object') {
				throw new ManifestValidationError('Each author must be an object');
			}
			const a = author as Record<string, unknown>;
			if (typeof a.name !== 'string' || !a.name) {
				throw new ManifestValidationError('Each author must have a name');
			}
		}
	}

	if (m.tags !== undefined) {
		if (!Array.isArray(m.tags)) {
			throw new ManifestValidationError('Manifest field tags must be an array');
		}
		for (const tag of m.tags) {
			if (typeof tag !== 'string') {
				throw new ManifestValidationError('Each tag must be a string');
			}
		}
	}
}

/**
 * Read and validate manifest from a PCD repository
 */
export async function loadManifest(pcdPath: string): Promise<Manifest> {
	const manifest = await readManifest(pcdPath);
	validateManifest(manifest);
	return manifest;
}

/**
 * Write manifest to a PCD repository
 */
export async function writeManifest(pcdPath: string, manifest: Manifest): Promise<void> {
	validateManifest(manifest);
	const manifestPath = `${pcdPath}/pcd.json`;
	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
	await logger.info(`Wrote manifest: ${manifest.name}`, {
		source: 'PCDManifest',
		meta: { path: pcdPath, manifest }
	});
}

// ============================================================================
// README HELPERS (merged from readme.ts)
// ============================================================================

/**
 * Read README from a PCD repository
 */
export async function readReadme(pcdPath: string): Promise<string | null> {
	try {
		return await fs.readFile(`${pcdPath}/README.md`, 'utf8');
	} catch {
		return null;
	}
}

/**
 * Write README to a PCD repository
 */
export async function writeReadme(pcdPath: string, content: string): Promise<void> {
	await fs.writeFile(`${pcdPath}/README.md`, content);
	await logger.info('Wrote README', {
		source: 'PCDManifest',
		meta: { path: pcdPath, content }
	});
}

// Re-export error for convenience
export { ManifestValidationError };
