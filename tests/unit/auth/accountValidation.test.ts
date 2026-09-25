/**
 * Tests for local account validation shared by first-run setup and the
 * security page, and for telling SSO accounts apart from password accounts.
 */

import { assertEquals } from '@std/assert';
import { Database } from '@db/sqlite';
import { isOidcUsername, validateNewLocalAccount } from '$auth/loginOptions.ts';

// --- validateNewLocalAccount ---

Deno.test('validateNewLocalAccount: valid account passes', () => {
	assertEquals(validateNewLocalAccount('admin', 'password123', 'password123'), null);
});

Deno.test('validateNewLocalAccount: username is required', () => {
	assertEquals(validateNewLocalAccount('', 'password123', 'password123'), 'Username is required');
});

Deno.test('validateNewLocalAccount: username must be at least 3 characters', () => {
	assertEquals(
		validateNewLocalAccount('ab', 'password123', 'password123'),
		'Username must be at least 3 characters'
	);
});

Deno.test('validateNewLocalAccount: password is required', () => {
	assertEquals(validateNewLocalAccount('admin', '', ''), 'Password is required');
});

Deno.test('validateNewLocalAccount: password must be at least 8 characters', () => {
	assertEquals(
		validateNewLocalAccount('admin', 'short', 'short'),
		'Password must be at least 8 characters'
	);
});

Deno.test('validateNewLocalAccount: passwords must match', () => {
	assertEquals(
		validateNewLocalAccount('admin', 'password123', 'password124'),
		'Passwords do not match'
	);
});

for (const username of ['oidc:admin', 'OIDC:admin', 'Oidc:admin', 'oidc:']) {
	Deno.test(`validateNewLocalAccount: rejects reserved username '${username}'`, () => {
		assertEquals(
			validateNewLocalAccount(username, 'password123', 'password123'),
			"Usernames starting with 'oidc:' are reserved for SSO accounts"
		);
	});
}

Deno.test('validateNewLocalAccount: oidc without a colon is allowed', () => {
	assertEquals(validateNewLocalAccount('oidcadmin', 'password123', 'password123'), null);
});

// --- isOidcUsername ---

const SAMPLES = [
	'admin',
	'oidc:abc',
	'OIDC:abc',
	'Oidc:abc',
	'oidc:',
	'oidc',
	'oidcadmin',
	'my-oidc:abc',
	' oidc:abc'
];

Deno.test('isOidcUsername: matches the oidc: prefix ignoring case', () => {
	assertEquals(
		SAMPLES.filter((name) => isOidcUsername(name)),
		['oidc:abc', 'OIDC:abc', 'Oidc:abc', 'oidc:']
	);
});

Deno.test('isOidcUsername agrees with the SQL used by usersQueries.existsLocal', () => {
	// existsLocal() and getAllUsernames() treat rows matching NOT LIKE 'oidc:%'
	// as password accounts. The app and SQL must agree on which is which.
	const db = new Database(':memory:');
	try {
		db.exec('CREATE TABLE users (username TEXT NOT NULL)');
		for (const name of SAMPLES) db.exec('INSERT INTO users (username) VALUES (?)', [name]);

		const local = db
			.prepare("SELECT username FROM users WHERE username NOT LIKE 'oidc:%'")
			.all<{ username: string }>()
			.map((r) => r.username);

		assertEquals(
			local,
			SAMPLES.filter((name) => !isOidcUsername(name))
		);
	} finally {
		db.close();
	}
});
