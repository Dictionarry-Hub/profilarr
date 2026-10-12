/**
 * Filesystem helpers
 */

/** True if a filesystem call failed because the path doesn't exist */
export function isNotFound(err: unknown): boolean {
	return (
		typeof err === 'object' &&
		err !== null &&
		'code' in err &&
		(err as { code: unknown }).code === 'ENOENT'
	);
}
