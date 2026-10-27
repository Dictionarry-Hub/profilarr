/**
 * Password hashing utilities using bcrypt (see ./bcrypt.ts)
 */

import { bcryptHash, bcryptVerify } from './bcrypt.ts';

/**
 * Hash a password using bcrypt
 */
export function hashPassword(password: string): Promise<string> {
	return bcryptHash(password);
}

/**
 * Verify a password against a stored hash
 */
export function verifyPassword(password: string, storedHash: string): Promise<boolean> {
	return bcryptVerify(password, storedHash);
}
