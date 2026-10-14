/**
 * Path validation utilities
 */

import { realpathSync } from 'node:fs';
import { resolve, isAbsolute } from 'node:path';
import { isNotFound } from './fs.ts';

/**
 * Validate that file paths don't escape the given root boundary.
 * Rejects absolute paths, ../ traversal sequences, and symlinks
 * that resolve outside the boundary.
 */
export function validateFilePaths(rootPath: string, filePaths: string[]): void {
	const root = resolve(rootPath);
	let realRoot: string;
	try {
		realRoot = realpathSync(rootPath);
	} catch {
		realRoot = root;
	}

	for (const fp of filePaths) {
		if (isAbsolute(fp)) {
			throw new Error('Invalid file path: absolute paths not allowed');
		}
		// Lexical check (catches ../ traversal)
		const resolved = resolve(rootPath, fp);
		if (!resolved.startsWith(root + '/')) {
			throw new Error('Invalid file path: path escapes repository boundary');
		}
		// Symlink check (catches symlinks pointing outside the boundary)
		try {
			const real = realpathSync(resolved);
			if (!real.startsWith(realRoot + '/')) {
				throw new Error('Invalid file path: path escapes repository boundary');
			}
		} catch (e) {
			if (isNotFound(e)) continue;
			throw e;
		}
	}
}
