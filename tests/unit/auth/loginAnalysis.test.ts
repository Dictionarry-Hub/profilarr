/**
 * Tests for login analysis utilities
 */

import { expect, test } from 'vitest';
import {
	isCommonAttackUsername,
	findSimilarUsername,
	analyzeLoginFailure,
	formatLoginFailure,
	getAttemptCategory
} from '#utils/auth/loginAnalysis.ts';

// --- isCommonAttackUsername ---

test('isCommonAttackUsername: detects common attack usernames', () => {
	expect(isCommonAttackUsername('admin')).toStrictEqual(true);
	expect(isCommonAttackUsername('root')).toStrictEqual(true);
	expect(isCommonAttackUsername('test')).toStrictEqual(true);
	expect(isCommonAttackUsername('guest')).toStrictEqual(true);
	expect(isCommonAttackUsername('default')).toStrictEqual(true);
});

test('isCommonAttackUsername: case insensitive', () => {
	expect(isCommonAttackUsername('Admin')).toStrictEqual(true);
	expect(isCommonAttackUsername('ROOT')).toStrictEqual(true);
	expect(isCommonAttackUsername('AdMiNiStRaToR')).toStrictEqual(true);
});

test('isCommonAttackUsername: rejects normal usernames', () => {
	expect(isCommonAttackUsername('santiago')).toStrictEqual(false);
	expect(isCommonAttackUsername('myuser123')).toStrictEqual(false);
	expect(isCommonAttackUsername('john.doe')).toStrictEqual(false);
});

// --- findSimilarUsername ---

test('findSimilarUsername: finds 1-edit typo', () => {
	expect(findSimilarUsername('santiag', ['santiago'])).toStrictEqual('santiago');
});

test('findSimilarUsername: finds 2-edit typo', () => {
	expect(findSimilarUsername('santago', ['santiago'])).toStrictEqual('santiago');
});

test('findSimilarUsername: rejects 3+ edit distance', () => {
	expect(findSimilarUsername('sant', ['santiago'])).toStrictEqual(null);
});

test('findSimilarUsername: exact match returns null (distance 0)', () => {
	expect(findSimilarUsername('santiago', ['santiago'])).toStrictEqual(null);
});

test('findSimilarUsername: case insensitive matching', () => {
	// 'Santiag' (capital S) lowercased to 'santiag' is 1 edit from 'santiago'
	expect(findSimilarUsername('Santiag', ['santiago'])).toStrictEqual('santiago');
});

test('findSimilarUsername: no match in empty list', () => {
	expect(findSimilarUsername('santiago', [])).toStrictEqual(null);
});

test('findSimilarUsername: returns first match from multiple users', () => {
	const result = findSimilarUsername('santiag', ['alice', 'santiago', 'bob']);
	expect(result).toStrictEqual('santiago');
});

// --- analyzeLoginFailure ---

test('analyzeLoginFailure: user exists with wrong password', () => {
	const result = analyzeLoginFailure('santiago', ['santiago'], true);
	expect(result.reason).toStrictEqual('invalid_password');
	expect(result.similarUser).toStrictEqual(null);
	expect(result.isCommonAttack).toStrictEqual(false);
});

test('analyzeLoginFailure: unknown user with common attack name', () => {
	const result = analyzeLoginFailure('admin', ['santiago'], false);
	expect(result.reason).toStrictEqual('user_not_found');
	expect(result.isCommonAttack).toStrictEqual(true);
});

test('analyzeLoginFailure: unknown user similar to existing', () => {
	const result = analyzeLoginFailure('santiag', ['santiago'], false);
	expect(result.reason).toStrictEqual('user_not_found');
	expect(result.similarUser).toStrictEqual('santiago');
	expect(result.isCommonAttack).toStrictEqual(false);
});

test('analyzeLoginFailure: unknown user no match', () => {
	const result = analyzeLoginFailure('xyzabc', ['santiago'], false);
	expect(result.reason).toStrictEqual('user_not_found');
	expect(result.similarUser).toStrictEqual(null);
	expect(result.isCommonAttack).toStrictEqual(false);
});

// --- formatLoginFailure ---

test('formatLoginFailure: invalid password', () => {
	expect(
		formatLoginFailure({ reason: 'invalid_password', similarUser: null, isCommonAttack: false })
	).toStrictEqual('invalid password');
});

test('formatLoginFailure: similar user', () => {
	expect(
		formatLoginFailure({
			reason: 'user_not_found',
			similarUser: 'santiago',
			isCommonAttack: false
		})
	).toStrictEqual("unknown user (similar to 'santiago')");
});

test('formatLoginFailure: common attack username', () => {
	expect(
		formatLoginFailure({ reason: 'user_not_found', similarUser: null, isCommonAttack: true })
	).toStrictEqual('unknown user (common attack username)');
});

test('formatLoginFailure: unknown user no match', () => {
	expect(
		formatLoginFailure({ reason: 'user_not_found', similarUser: null, isCommonAttack: false })
	).toStrictEqual('unknown user');
});

// --- getAttemptCategory ---

test('getAttemptCategory: invalid password is typo', () => {
	expect(
		getAttemptCategory({ reason: 'invalid_password', similarUser: null, isCommonAttack: false })
	).toStrictEqual('typo');
});

test('getAttemptCategory: similar username is typo', () => {
	expect(
		getAttemptCategory({
			reason: 'user_not_found',
			similarUser: 'santiago',
			isCommonAttack: false
		})
	).toStrictEqual('typo');
});

test('getAttemptCategory: common attack username is suspicious', () => {
	expect(
		getAttemptCategory({ reason: 'user_not_found', similarUser: null, isCommonAttack: true })
	).toStrictEqual('suspicious');
});

test('getAttemptCategory: unknown user no match is unknown', () => {
	expect(
		getAttemptCategory({ reason: 'user_not_found', similarUser: null, isCommonAttack: false })
	).toStrictEqual('unknown');
});
