/**
 * ULID generator (Universally Unique Lexicographically sortable Identifier).
 *
 * 26 chars in Crockford Base32: a 48-bit millisecond timestamp followed by
 * 80 bits of crypto randomness. Sorts lexicographically by creation time,
 * which is why we use it for announcement filenames (newest at the bottom
 * of `ls` is convenient for maintainers).
 *
 * Spec: https://github.com/ulid/spec
 */

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

const TIME_LEN = 10;
const RANDOM_LEN = 16;

/** Generate a fresh ULID using the current time. */
export function generateUlid(): string {
	return encodeTime(Date.now(), TIME_LEN) + encodeRandom(RANDOM_LEN);
}

function encodeTime(ms: number, length: number): string {
	let value = ms;
	let out = '';
	for (let i = length - 1; i >= 0; i--) {
		const mod = value % 32;
		out = CROCKFORD[mod] + out;
		value = Math.floor(value / 32);
	}
	return out;
}

function encodeRandom(length: number): string {
	const bytes = new Uint8Array(length);
	crypto.getRandomValues(bytes);
	let out = '';
	// `byte % 32` is bias-free because 256 is an exact multiple of 32.
	for (const byte of bytes) {
		out += CROCKFORD[byte % 32];
	}
	return out;
}
