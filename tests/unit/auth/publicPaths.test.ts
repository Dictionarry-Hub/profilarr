/**
 * Tests for auth middleware utilities
 */

import { test } from 'vitest';
import { assertEquals } from '@std/assert';
import { isPublicPath } from '#utils/auth/publicPaths.ts';

// Public paths (no session required)
test('isPublicPath: /auth/login', () => {
	assertEquals(isPublicPath('/auth/login'), true);
});

test('isPublicPath: /auth/setup', () => {
	assertEquals(isPublicPath('/auth/setup'), true);
});

test('isPublicPath: /auth/oidc', () => {
	assertEquals(isPublicPath('/auth/oidc'), true);
});

test('isPublicPath: /api/v1/health', () => {
	assertEquals(isPublicPath('/api/v1/health'), true);
});

// Subpaths of public paths
test('isPublicPath: /auth/oidc/login', () => {
	assertEquals(isPublicPath('/auth/oidc/login'), true);
});

test('isPublicPath: /auth/oidc/callback', () => {
	assertEquals(isPublicPath('/auth/oidc/callback'), true);
});

// Protected paths
test('isPublicPath: / is protected', () => {
	assertEquals(isPublicPath('/'), false);
});

test('isPublicPath: /settings is protected', () => {
	assertEquals(isPublicPath('/settings'), false);
});

test('isPublicPath: /api/v1/sync is protected', () => {
	assertEquals(isPublicPath('/api/v1/sync'), false);
});

test('isPublicPath: /auth/logout is protected', () => {
	assertEquals(isPublicPath('/auth/logout'), false);
});

test('isPublicPath: /auth is protected', () => {
	assertEquals(isPublicPath('/auth'), false);
});

test('isPublicPath: /databases is protected', () => {
	assertEquals(isPublicPath('/databases'), false);
});
