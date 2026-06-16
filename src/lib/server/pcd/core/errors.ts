/**
 * PCD Error Classes
 * Custom error types for the PCD system
 */

/**
 * Base error class for PCD-related errors
 */
export class PCDError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'PCDError';
	}
}

/**
 * Error during cache building
 */
export class CacheBuildError extends PCDError {
	constructor(
		message: string,
		public readonly databaseInstanceId?: number
	) {
		super(message);
		this.name = 'CacheBuildError';
	}
}

/**
 * Error during operation execution
 */
export class OperationError extends PCDError {
	constructor(
		message: string,
		public readonly operation?: string,
		public readonly layer?: string
	) {
		super(message);
		this.name = 'OperationError';
	}
}

/**
 * Error during SQL validation
 */
export class ValidationError extends PCDError {
	constructor(
		message: string,
		public readonly sql?: string[]
	) {
		super(message);
		this.name = 'ValidationError';
	}
}

/**
 * Error during dependency resolution
 */
export class DependencyError extends PCDError {
	constructor(
		message: string,
		public readonly dependency?: string
	) {
		super(message);
		this.name = 'DependencyError';
	}
}

/**
 * Error during manifest validation
 */
export class ManifestValidationError extends PCDError {
	constructor(message: string) {
		super(message);
		this.name = 'ManifestValidationError';
	}
}

/**
 * Error when a name already exists in the target (duplicate conflict)
 */
export class ConflictError extends PCDError {
	constructor(message: string) {
		super(message);
		this.name = 'ConflictError';
	}
}
