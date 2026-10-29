/**
 * Tests for local account validation shared by first-run setup and the
 * security page, and for telling SSO accounts apart from password accounts.
 */

import { expect, test } from 'vitest';
import { Database } from '#db/sqlite.ts';
import { isOidcUsername, validateNewLocalAccount } from '#utils/auth/loginOptions.ts';

// --- validateNewLocalAccount ---

test('validateNewLocalAccount: valid account passes', () => {
	expect(validateNewLocalAccount('admin', 'password123', 'password123')).toStrictEqual(null);
});

test('validateNewLocalAccount: username is required', () => {
	expect(validateNewLocalAccount('', 'password123', 'password123')).toStrictEqual(
		'Username is required'
	);
});

test('validateNewLocalAccount: username must be at least 3 characters', () => {
	expect(validateNewLocalAccount('ab', 'password123', 'password123')).toStrictEqual(
		'Username must be at least 3 characters'
	);
});

test('validateNewLocalAccount: password is required', () => {
	expect(validateNewLocalAccount('admin', '', '')).toStrictEqual('Password is required');
});

test('validateNewLocalAccount: password must be at least 8 characters', () => {
	expect(validateNewLocalAccount('admin', 'short', 'short')).toStrictEqual(
		'Password must be at least 8 characters'
	);
});

test('validateNewLocalAccount: passwords must match', () => {
	expect(validateNewLocalAccount('admin', 'password123', 'password124')).toStrictEqual(
		'Passwords do not match'
	);
});

for (const username of ['oidc:admin', 'OIDC:admin', 'Oidc:admin', 'oidc:']) {
	test(`validateNewLocalAccount: rejects reserved username '${username}'`, () => {
		expect(validateNewLocalAccount(username, 'password123', 'password123')).toStrictEqual(
			"Usernames starting with 'oidc:' are reserved for SSO accounts"
		);
	});
}

test('validateNewLocalAccount: oidc without a colon is allowed', () => {
	expect(validateNewLocalAccount('oidcadmin', 'password123', 'password123')).toStrictEqual(null);
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

test('isOidcUsername: matches the oidc: prefix ignoring case', () => {
	expect(SAMPLES.filter((name) => isOidcUsername(name))).toStrictEqual([
		'oidc:abc',
		'OIDC:abc',
		'Oidc:abc',
		'oidc:'
	]);
});

test('isOidcUsername agrees with the SQL used by usersQueries.existsLocal', () => {
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

		expect(local).toStrictEqual(SAMPLES.filter((name) => !isOidcUsername(name)));
	} finally {
		db.close();
	}
});
