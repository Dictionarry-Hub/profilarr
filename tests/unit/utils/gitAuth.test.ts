/**
 * Tests for the environment that sends a GitHub token to git as a header.
 */

import { expect, test } from 'vitest';
import { Buffer } from 'node:buffer';
import { GIT_ENV } from '#utils/git/exec.ts';
import { githubAuthHeader, withGitAuth } from '#utils/git/auth.ts';

const TOKEN = 'ghp_exampleToken123';

function decodeHeader(header: string): string {
	const prefix = 'Authorization: Basic ';
	expect(header.startsWith(prefix), `expected a Basic header, got ${header}`).toBeTruthy();
	return Buffer.from(header.slice(prefix.length), 'base64').toString('utf8');
}

test('githubAuthHeader: Basic header of x-access-token and the token', () => {
	const header = githubAuthHeader(TOKEN);
	expect(header).toStrictEqual(`Authorization: Basic ${btoa(`x-access-token:${TOKEN}`)}`);
	expect(decodeHeader(header)).toStrictEqual(`x-access-token:${TOKEN}`);
});

test('withGitAuth: scopes the header to https://github.com/', () => {
	const env = withGitAuth({}, TOKEN);
	expect(env).toStrictEqual({
		GIT_CONFIG_COUNT: '1',
		GIT_CONFIG_KEY_0: 'http.https://github.com/.extraHeader',
		GIT_CONFIG_VALUE_0: githubAuthHeader(TOKEN)
	});
});

test("withGitAuth: keeps GIT_ENV's credential.helper entry and takes the next index", () => {
	const env = withGitAuth(GIT_ENV, TOKEN);
	expect(env).toStrictEqual({
		...GIT_ENV,
		GIT_CONFIG_COUNT: '2',
		GIT_CONFIG_KEY_0: 'credential.helper',
		GIT_CONFIG_VALUE_0: '',
		GIT_CONFIG_KEY_1: 'http.https://github.com/.extraHeader',
		GIT_CONFIG_VALUE_1: githubAuthHeader(TOKEN)
	});
});

test('withGitAuth: appends after any number of existing entries', () => {
	const base = {
		GIT_CONFIG_COUNT: '3',
		GIT_CONFIG_KEY_0: 'a.b',
		GIT_CONFIG_VALUE_0: '0',
		GIT_CONFIG_KEY_1: 'c.d',
		GIT_CONFIG_VALUE_1: '1',
		GIT_CONFIG_KEY_2: 'e.f',
		GIT_CONFIG_VALUE_2: '2'
	};
	const env = withGitAuth(base, TOKEN);
	expect(env.GIT_CONFIG_COUNT).toStrictEqual('4');
	expect(env.GIT_CONFIG_KEY_2).toStrictEqual('e.f');
	expect(env.GIT_CONFIG_KEY_3).toStrictEqual('http.https://github.com/.extraHeader');
	expect(env.GIT_CONFIG_VALUE_3).toStrictEqual(githubAuthHeader(TOKEN));
});

test('withGitAuth: adds no entries without a token', () => {
	expect(withGitAuth(GIT_ENV)).toBe(GIT_ENV);
	expect(withGitAuth(GIT_ENV, null)).toBe(GIT_ENV);
	expect(withGitAuth(GIT_ENV, '')).toBe(GIT_ENV);
	expect(GIT_ENV.GIT_CONFIG_COUNT).toStrictEqual('1');
});

test('withGitAuth: leaves the base environment unchanged', () => {
	const before = { ...GIT_ENV };
	withGitAuth(GIT_ENV, TOKEN);
	expect(GIT_ENV).toStrictEqual(before);
});

test('withGitAuth: the token appears only in the header value', () => {
	const env = withGitAuth(GIT_ENV, TOKEN);
	for (const [key, value] of Object.entries(env)) {
		expect(!key.includes(TOKEN), `${key} should not hold the token`).toBeTruthy();
		expect(!value.includes(TOKEN), `${key} should not hold the raw token`).toBeTruthy();
	}
});
