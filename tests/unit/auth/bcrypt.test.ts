import { expect, test } from 'vitest';
import { BCRYPT_COST, hash, verify } from '#utils/auth/bcrypt.ts';

// Made by @felix/bcrypt (the native library Profilarr used before bcryptjs) at
// its default cost of 12. Existing passwords and API keys are stored like this.
const NATIVE_HASH = '$2b$12$Ji1Al6Uk9OmcjThzIePDEehODWjO..hiVNY30ukZUmvN8SVwHbkye';
const NATIVE_SECRET = 'profilarr-compat-check';

test('bcrypt: a hash made by @felix/bcrypt verifies', async () => {
	expect(await verify(NATIVE_SECRET, NATIVE_HASH)).toBeTruthy();
	expect(!(await verify('wrong-secret', NATIVE_HASH))).toBeTruthy();
});

test('bcrypt: new hashes use cost 12, like @felix/bcrypt', async () => {
	const hashed = await hash('a-new-secret');
	expect(hashed.slice(0, 7)).toStrictEqual(`$2b$${BCRYPT_COST}$`);
	expect(await verify('a-new-secret', hashed)).toBeTruthy();
});
