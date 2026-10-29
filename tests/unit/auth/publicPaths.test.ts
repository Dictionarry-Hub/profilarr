/**
 * Tests for auth middleware utilities
 */

import { expect, test } from 'vitest';
import { isPublicPath } from '#utils/auth/publicPaths.ts';

// Public paths (no session required)
test('isPublicPath: /auth/login', () => {
	expect(isPublicPath('/auth/login')).toStrictEqual(true);
});

test('isPublicPath: /auth/setup', () => {
	expect(isPublicPath('/auth/setup')).toStrictEqual(true);
});

test('isPublicPath: /auth/oidc', () => {
	expect(isPublicPath('/auth/oidc')).toStrictEqual(true);
});

test('isPublicPath: /api/v1/health', () => {
	expect(isPublicPath('/api/v1/health')).toStrictEqual(true);
});

// Subpaths of public paths
test('isPublicPath: /auth/oidc/login', () => {
	expect(isPublicPath('/auth/oidc/login')).toStrictEqual(true);
});

test('isPublicPath: /auth/oidc/callback', () => {
	expect(isPublicPath('/auth/oidc/callback')).toStrictEqual(true);
});

// Protected paths
test('isPublicPath: / is protected', () => {
	expect(isPublicPath('/')).toStrictEqual(false);
});

test('isPublicPath: /settings is protected', () => {
	expect(isPublicPath('/settings')).toStrictEqual(false);
});

test('isPublicPath: /api/v1/sync is protected', () => {
	expect(isPublicPath('/api/v1/sync')).toStrictEqual(false);
});

test('isPublicPath: /auth/logout is protected', () => {
	expect(isPublicPath('/auth/logout')).toStrictEqual(false);
});

test('isPublicPath: /auth is protected', () => {
	expect(isPublicPath('/auth')).toStrictEqual(false);
});

test('isPublicPath: /databases is protected', () => {
	expect(isPublicPath('/databases')).toStrictEqual(false);
});
