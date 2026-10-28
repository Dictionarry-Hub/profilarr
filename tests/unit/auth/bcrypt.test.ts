import { test } from 'vitest';
import { assert, assertEquals } from '@std/assert';
import { BCRYPT_COST, hash, verify } from '$auth/bcrypt.ts';

// Made by @felix/bcrypt (the native library Profilarr used before bcryptjs) at
// its default cost of 12. Existing passwords and API keys are stored like this.
const NATIVE_HASH = '$2b$12$Ji1Al6Uk9OmcjThzIePDEehODWjO..hiVNY30ukZUmvN8SVwHbkye';
const NATIVE_SECRET = 'profilarr-compat-check';

test('bcrypt: a hash made by @felix/bcrypt verifies', async () => {
	assert(await verify(NATIVE_SECRET, NATIVE_HASH));
	assert(!(await verify('wrong-secret', NATIVE_HASH)));
});

test('bcrypt: new hashes use cost 12, like @felix/bcrypt', async () => {
	const hashed = await hash('a-new-secret');
	assertEquals(hashed.slice(0, 7), `$2b$${BCRYPT_COST}$`);
	assert(await verify('a-new-secret', hashed));
});
