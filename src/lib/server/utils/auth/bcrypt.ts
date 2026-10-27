/**
 * bcrypt for passwords and API keys, via bcryptjs (pure JavaScript, no FFI).
 *
 * New hashes use cost 12, as @felix/bcrypt did. bcryptjs defaults to 10, so
 * every hash goes through here. A stored hash carries its own cost and salt,
 * so hashes made by @felix/bcrypt verify unchanged.
 */

import { compare, hash } from 'bcryptjs';

export const BCRYPT_COST = 12;

/** Hash a secret at cost 12 */
export function bcryptHash(secret: string): Promise<string> {
	return hash(secret, BCRYPT_COST);
}

/** Check a secret against a stored bcrypt hash */
export function bcryptVerify(secret: string, storedHash: string): Promise<boolean> {
	return compare(secret, storedHash);
}
