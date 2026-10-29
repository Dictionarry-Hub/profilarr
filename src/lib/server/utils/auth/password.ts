/**
 * Password hashing utilities using bcrypt (see ./bcrypt.ts)
 */

import { hash, verify } from './bcrypt.ts';

/**
 * Hash a password using bcrypt
 */
export function hashPassword(password: string): Promise<string> {
	return hash(password);
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	return verify(password, storedHash);
}
