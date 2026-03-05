/**
 * Tests for auth middleware utilities
 */

import { assertEquals } from '@std/assert';
import { isPublicPath } from '$auth/publicPaths.ts';

// Public paths (no session required)
Deno.test('isPublicPath: /auth/login', () => {
	assertEquals(isPublicPath('/auth/login'), true);
});

Deno.test('isPublicPath: /auth/setup', () => {
	assertEquals(isPublicPath('/auth/setup'), true);
});

Deno.test('isPublicPath: /auth/oidc', () => {
	assertEquals(isPublicPath('/auth/oidc'), true);
});

Deno.test('isPublicPath: /api/v1/health', () => {
	assertEquals(isPublicPath('/api/v1/health'), true);
});

// Subpaths of public paths
Deno.test('isPublicPath: /auth/oidc/login', () => {
	assertEquals(isPublicPath('/auth/oidc/login'), true);
});

Deno.test('isPublicPath: /auth/oidc/callback', () => {
	assertEquals(isPublicPath('/auth/oidc/callback'), true);
});

// Protected paths
Deno.test('isPublicPath: / is protected', () => {
	assertEquals(isPublicPath('/'), false);
});

Deno.test('isPublicPath: /settings is protected', () => {
	assertEquals(isPublicPath('/settings'), false);
});

Deno.test('isPublicPath: /api/v1/sync is protected', () => {
	assertEquals(isPublicPath('/api/v1/sync'), false);
});

Deno.test('isPublicPath: /auth/logout is protected', () => {
	assertEquals(isPublicPath('/auth/logout'), false);
});

Deno.test('isPublicPath: /auth is protected', () => {
	assertEquals(isPublicPath('/auth'), false);
});

Deno.test('isPublicPath: /databases is protected', () => {
	assertEquals(isPublicPath('/databases'), false);
});
