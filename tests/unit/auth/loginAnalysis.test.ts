/**
 * Tests for login analysis utilities
 */

import { assertEquals } from '@std/assert';
import {
	isCommonAttackUsername,
	findSimilarUsername,
	analyzeLoginFailure,
	formatLoginFailure,
	getAttemptCategory
} from '$auth/loginAnalysis.ts';

// --- isCommonAttackUsername ---

Deno.test('isCommonAttackUsername: detects common attack usernames', () => {
	assertEquals(isCommonAttackUsername('admin'), true);
	assertEquals(isCommonAttackUsername('root'), true);
	assertEquals(isCommonAttackUsername('test'), true);
	assertEquals(isCommonAttackUsername('guest'), true);
	assertEquals(isCommonAttackUsername('default'), true);
});

Deno.test('isCommonAttackUsername: case insensitive', () => {
	assertEquals(isCommonAttackUsername('Admin'), true);
	assertEquals(isCommonAttackUsername('ROOT'), true);
	assertEquals(isCommonAttackUsername('AdMiNiStRaToR'), true);
});

Deno.test('isCommonAttackUsername: rejects normal usernames', () => {
	assertEquals(isCommonAttackUsername('santiago'), false);
	assertEquals(isCommonAttackUsername('myuser123'), false);
	assertEquals(isCommonAttackUsername('john.doe'), false);
});

// --- findSimilarUsername ---

Deno.test('findSimilarUsername: finds 1-edit typo', () => {
	assertEquals(findSimilarUsername('santiag', ['santiago']), 'santiago');
});

Deno.test('findSimilarUsername: finds 2-edit typo', () => {
	assertEquals(findSimilarUsername('santago', ['santiago']), 'santiago');
});

Deno.test('findSimilarUsername: rejects 3+ edit distance', () => {
	assertEquals(findSimilarUsername('sant', ['santiago']), null);
});

Deno.test('findSimilarUsername: exact match returns null (distance 0)', () => {
	assertEquals(findSimilarUsername('santiago', ['santiago']), null);
});

Deno.test('findSimilarUsername: case insensitive matching', () => {
	// 'Santiag' (capital S) lowercased to 'santiag' is 1 edit from 'santiago'
	assertEquals(findSimilarUsername('Santiag', ['santiago']), 'santiago');
});

Deno.test('findSimilarUsername: no match in empty list', () => {
	assertEquals(findSimilarUsername('santiago', []), null);
});

Deno.test('findSimilarUsername: returns first match from multiple users', () => {
	const result = findSimilarUsername('santiag', ['alice', 'santiago', 'bob']);
	assertEquals(result, 'santiago');
});

// --- analyzeLoginFailure ---

Deno.test('analyzeLoginFailure: user exists with wrong password', () => {
	const result = analyzeLoginFailure('santiago', ['santiago'], true);
	assertEquals(result.reason, 'invalid_password');
	assertEquals(result.similarUser, null);
	assertEquals(result.isCommonAttack, false);
});

Deno.test('analyzeLoginFailure: unknown user with common attack name', () => {
	const result = analyzeLoginFailure('admin', ['santiago'], false);
	assertEquals(result.reason, 'user_not_found');
	assertEquals(result.isCommonAttack, true);
});

Deno.test('analyzeLoginFailure: unknown user similar to existing', () => {
	const result = analyzeLoginFailure('santiag', ['santiago'], false);
	assertEquals(result.reason, 'user_not_found');
	assertEquals(result.similarUser, 'santiago');
	assertEquals(result.isCommonAttack, false);
});

Deno.test('analyzeLoginFailure: unknown user no match', () => {
	const result = analyzeLoginFailure('xyzabc', ['santiago'], false);
	assertEquals(result.reason, 'user_not_found');
	assertEquals(result.similarUser, null);
	assertEquals(result.isCommonAttack, false);
});

// --- formatLoginFailure ---

Deno.test('formatLoginFailure: invalid password', () => {
	assertEquals(
		formatLoginFailure({ reason: 'invalid_password', similarUser: null, isCommonAttack: false }),
		'invalid password'
	);
});

Deno.test('formatLoginFailure: similar user', () => {
	assertEquals(
		formatLoginFailure({
			reason: 'user_not_found',
			similarUser: 'santiago',
			isCommonAttack: false
		}),
		"unknown user (similar to 'santiago')"
	);
});

Deno.test('formatLoginFailure: common attack username', () => {
	assertEquals(
		formatLoginFailure({ reason: 'user_not_found', similarUser: null, isCommonAttack: true }),
		'unknown user (common attack username)'
	);
});

Deno.test('formatLoginFailure: unknown user no match', () => {
	assertEquals(
		formatLoginFailure({ reason: 'user_not_found', similarUser: null, isCommonAttack: false }),
		'unknown user'
	);
});

// --- getAttemptCategory ---

Deno.test('getAttemptCategory: invalid password is typo', () => {
	assertEquals(
		getAttemptCategory({ reason: 'invalid_password', similarUser: null, isCommonAttack: false }),
		'typo'
	);
});

Deno.test('getAttemptCategory: similar username is typo', () => {
	assertEquals(
		getAttemptCategory({
			reason: 'user_not_found',
			similarUser: 'santiago',
			isCommonAttack: false
		}),
		'typo'
	);
});

Deno.test('getAttemptCategory: common attack username is suspicious', () => {
	assertEquals(
		getAttemptCategory({ reason: 'user_not_found', similarUser: null, isCommonAttack: true }),
		'suspicious'
	);
});

Deno.test('getAttemptCategory: unknown user no match is unknown', () => {
	assertEquals(
		getAttemptCategory({ reason: 'user_not_found', similarUser: null, isCommonAttack: false }),
		'unknown'
	);
});
