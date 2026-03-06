/**
 * PCD Public API
 * Re-exports for external consumers
 */

// ============================================================================
// MANAGER
// ============================================================================

export { pcdManager } from './core/manager.ts';

// ============================================================================
// CACHE
// ============================================================================

export { PCDCache } from './database/cache.ts';
export { getCache, getCachedDatabaseIds } from './database/registry.ts';
export { compile, invalidate, invalidateAll } from './database/compiler.ts';

// ============================================================================
// WRITER
// ============================================================================

export { writeOperation, recompileCache, canWriteToBase } from './ops/writer.ts';

// ============================================================================
// MANIFEST
// ============================================================================

export {
	loadManifest,
	readManifest,
	validateManifest,
	writeManifest,
	readReadme,
	writeReadme
} from './manifest/manifest.ts';
export type { Manifest } from './manifest/manifest.ts';

// ============================================================================
// DEPENDENCIES
// ============================================================================

export { processDependencies, syncDependencies, validateDependencies } from './git/dependencies.ts';

// ============================================================================
// OPERATIONS
// ============================================================================

export { loadAllOperations } from './ops/loadOps.ts';
export {
	loadOperationsFromDir,
	validateOperations,
	getPCDPath,
	getUserOpsPath,
	getBaseOpsPath
} from './utils/operations.ts';
export { compiledQueryToSql, formatValue } from './utils/sql.ts';

// ============================================================================
// TYPES
// ============================================================================

export type {
	CacheBuildStats,
	Operation,
	OperationLayer,
	OperationType,
	OperationMetadata,
	WritableLayer,
	WriteOptions,
	WriteResult,
	ValidationResult,
	LinkOptions,
	SyncResult
} from './core/types.ts';

// ============================================================================
// ERRORS
// ============================================================================

export {
	PCDError,
	CacheBuildError,
	OperationError,
	ValidationError,
	DependencyError,
	ManifestValidationError
} from './core/errors.ts';
