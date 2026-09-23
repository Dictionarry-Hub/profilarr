/**
 * Tests for API key permission lookup and enforcement
 */

import { assertEquals } from '@std/assert';
import {
	API_AREAS,
	checkApiKeyAccess,
	getApiRequirement,
	routeIdToSpecPath
} from '$auth/apiPermissions.ts';
import type { ApiKeyPermissions } from '$shared/apiKeys.ts';

function key(permissions: ApiKeyPermissions) {
	return { id: 1, name: 'test', permissions };
}

// --- routeIdToSpecPath ---

Deno.test('routeIdToSpecPath: converts params to spec form', () => {
	assertEquals(routeIdToSpecPath('/api/v1/databases/[id]/sync'), '/databases/{id}/sync');
});

Deno.test('routeIdToSpecPath: keeps dotted segments', () => {
	assertEquals(routeIdToSpecPath('/api/v1/openapi.json'), '/openapi.json');
});

Deno.test('routeIdToSpecPath: drops route groups', () => {
	assertEquals(routeIdToSpecPath('/api/v1/(internal)/jobs/[id]'), '/jobs/{id}');
});

Deno.test('routeIdToSpecPath: rejects rest, optional, and matcher params', () => {
	assertEquals(routeIdToSpecPath('/api/v1/files/[...rest]'), null);
	assertEquals(routeIdToSpecPath('/api/v1/files/[[page]]'), null);
	assertEquals(routeIdToSpecPath('/api/v1/jobs/[id=integer]'), null);
});

Deno.test('routeIdToSpecPath: rejects routes outside /api/v1', () => {
	assertEquals(routeIdToSpecPath('/settings/security'), null);
	assertEquals(routeIdToSpecPath('/api/v10/status'), null);
});

// --- getApiRequirement ---

Deno.test('getApiRequirement: reads area and access from the spec', () => {
	assertEquals(getApiRequirement('/api/v1/databases/[id]', 'PATCH'), {
		area: 'databases',
		access: 'write'
	});
	assertEquals(getApiRequirement('/api/v1/databases', 'GET'), {
		area: 'databases',
		access: 'read'
	});
});

Deno.test('getApiRequirement: ignores parameter names', () => {
	assertEquals(getApiRequirement('/api/v1/databases/[databaseId]', 'GET'), {
		area: 'databases',
		access: 'read'
	});
});

Deno.test('getApiRequirement: treats HEAD as GET', () => {
	assertEquals(getApiRequirement('/api/v1/status', 'HEAD'), { area: 'system', access: 'read' });
});

Deno.test('getApiRequirement: public and unknown operations have no requirement', () => {
	assertEquals(getApiRequirement('/api/v1/health', 'GET'), null);
	assertEquals(getApiRequirement('/api/v1/status', 'DELETE'), null);
	assertEquals(getApiRequirement('/api/v1/nope', 'GET'), null);
});

// --- checkApiKeyAccess ---

Deno.test('checkApiKeyAccess: full access passes everything', () => {
	assertEquals(checkApiKeyAccess(key('all'), '/api/v1/databases/[id]', 'DELETE'), null);
	assertEquals(checkApiKeyAccess(key('all'), '/api/v1/nope', 'GET'), null);
});

Deno.test('checkApiKeyAccess: write includes read', () => {
	assertEquals(checkApiKeyAccess(key({ databases: 'write' }), '/api/v1/databases', 'GET'), null);
});

Deno.test('checkApiKeyAccess: read does not include write', () => {
	assertEquals(
		checkApiKeyAccess(key({ databases: 'read' }), '/api/v1/databases/[id]', 'PATCH'),
		'API key does not have write access to Databases'
	);
});

Deno.test('checkApiKeyAccess: other areas are denied', () => {
	assertEquals(
		checkApiKeyAccess(key({ databases: 'write' }), '/api/v1/status', 'GET'),
		'API key does not have read access to System'
	);
});

Deno.test('checkApiKeyAccess: unlabelled operations are denied to scoped keys', () => {
	assertEquals(
		checkApiKeyAccess(key({ system: 'read' }), '/api/v1/nope', 'GET'),
		'API key does not have access to this endpoint'
	);
});

// --- API_AREAS ---

Deno.test('API_AREAS: one area per spec tag, writable only where a write exists', () => {
	const areas = Object.fromEntries(API_AREAS.map((area) => [area.id, area.writable]));
	assertEquals(areas, {
		system: false,
		jobs: false,
		backups: true,
		arr: false,
		databases: true,
		announcements: false
	});
});
