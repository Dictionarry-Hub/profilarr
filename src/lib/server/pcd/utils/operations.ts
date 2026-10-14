/**
 * PCD Operations Loader
 * Utilities for loading and managing SQL operations from PCD layers
 */

import * as fs from 'node:fs/promises';
import { config } from '$config';
import type { Operation } from '../core/types.ts';

/**
 * Check if a path exists
 */
async function pathExists(path: string): Promise<boolean> {
	try {
		await fs.stat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Load SQL operations from a directory, sorted by filename
 */
export async function loadOperationsFromDir(
	dirPath: string,
	layer: 'schema' | 'base' | 'tweaks' | 'user'
): Promise<Operation[]> {
	if (!(await pathExists(dirPath))) {
		return [];
	}

	const operations: Operation[] = [];

	try {
		for (const entry of await fs.readdir(dirPath, { withFileTypes: true })) {
			if (!entry.isFile() || !entry.name.endsWith('.sql')) {
				continue;
			}

			const filepath = `${dirPath}/${entry.name}`;
			const sql = await fs.readFile(filepath, 'utf8');
			const order = extractOrderFromFilename(entry.name);

			operations.push({
				filename: entry.name,
				filepath,
				sql,
				order,
				layer
			});
		}
	} catch (error) {
		throw new Error(`Failed to read operations from ${dirPath}: ${error}`);
	}

	// Sort by order (numeric prefix)
	return operations.sort((a, b) => a.order - b.order);
}

/**
 * Extract numeric order from filename prefix
 * Examples:
 *   "0.schema.sql" -> 0
 *   "1.initial.sql" -> 1
 *   "10.advanced.sql" -> 10
 *   "allow-DV.sql" -> Infinity (no prefix)
 */
export function extractOrderFromFilename(filename: string): number {
	const match = filename.match(/^(\d+)\./);
	if (match) {
		return parseInt(match[1], 10);
	}
	return Infinity; // Files without numeric prefix go last
}

/**
 * Load all operations for a PCD in layer order:
 * 1. Schema layer (from dependency)
 * 2. Base layer (from PCD)
 * 3. Tweaks layer (from PCD, optional)
 * 4. User ops layer (local user modifications)
 */
export async function loadAllOperations(pcdPath: string): Promise<Operation[]> {
	const allOperations: Operation[] = [];

	// 1. Load schema layer from dependency
	const schemaPath = `${pcdPath}/deps/schema/ops`;
	const schemaOps = await loadOperationsFromDir(schemaPath, 'schema');
	allOperations.push(...schemaOps);

	// 2. Load base layer from PCD
	const basePath = `${pcdPath}/ops`;
	const baseOps = await loadOperationsFromDir(basePath, 'base');
	allOperations.push(...baseOps);

	// 3. Load tweaks layer (optional)
	const tweaksPath = `${pcdPath}/tweaks`;
	const tweakOps = await loadOperationsFromDir(tweaksPath, 'tweaks');
	allOperations.push(...tweakOps);

	// 4. User ops layer (local user modifications)
	const userOpsPath = `${pcdPath}/user_ops`;
	const userOps = await loadOperationsFromDir(userOpsPath, 'user');
	allOperations.push(...userOps);

	return allOperations;
}

/**
 * Validate that operations can be executed
 * - Check for empty SQL
 * - Check for duplicate order numbers within a layer
 */
export function validateOperations(operations: Operation[]): void {
	for (const op of operations) {
		if (!op.sql.trim()) {
			throw new Error(`Operation ${op.filename} in ${op.layer} layer is empty`);
		}
	}

	// Check for duplicate order numbers within each layer
	const layerOrders = new Map<string, Set<number>>();
	for (const op of operations) {
		if (op.order === Infinity) continue; // Skip unprefixed files

		if (!layerOrders.has(op.layer)) {
			layerOrders.set(op.layer, new Set());
		}

		const orders = layerOrders.get(op.layer)!;
		if (orders.has(op.order)) {
			throw new Error(`Duplicate order number ${op.order} in ${op.layer} layer (${op.filename})`);
		}
		orders.add(op.order);
	}
}

// ============================================================================
// PATH HELPERS
// ============================================================================

/**
 * Get the filesystem path for a PCD repository
 */
export function getPCDPath(uuid: string): string {
	return `${config.paths.databases}/${uuid}`;
}

/**
 * Get the user ops directory path for a PCD
 */
export function getUserOpsPath(pcdPath: string): string {
	return `${pcdPath}/user_ops`;
}

/**
 * Get the base ops directory path for a PCD
 */
export function getBaseOpsPath(pcdPath: string): string {
	return `${pcdPath}/ops`;
}
