/**
 * Tests for API key permission lookup and enforcement
 */

import { expect, test } from 'vitest';
import {
	API_AREAS,
	checkApiKeyAccess,
	getApiRequirement,
	routeIdToSpecPath
} from '#utils/auth/apiPermissions.ts';
import type { ApiKeyPermissions } from '#shared/apiKeys.ts';

function key(permissions: ApiKeyPermissions) {
	return { id: 1, name: 'test', permissions };
}

// --- routeIdToSpecPath ---

test('routeIdToSpecPath: converts params to spec form', () => {
	expect(routeIdToSpecPath('/api/v1/databases/[id]/sync')).toStrictEqual('/databases/{id}/sync');
});

test('routeIdToSpecPath: keeps dotted segments', () => {
	expect(routeIdToSpecPath('/api/v1/openapi.json')).toStrictEqual('/openapi.json');
});

test('routeIdToSpecPath: drops route groups', () => {
	expect(routeIdToSpecPath('/api/v1/(internal)/jobs/[id]')).toStrictEqual('/jobs/{id}');
});

test('routeIdToSpecPath: rejects rest, optional, and matcher params', () => {
	expect(routeIdToSpecPath('/api/v1/files/[...rest]')).toStrictEqual(null);
	expect(routeIdToSpecPath('/api/v1/files/[[page]]')).toStrictEqual(null);
	expect(routeIdToSpecPath('/api/v1/jobs/[id=integer]')).toStrictEqual(null);
});

test('routeIdToSpecPath: rejects routes outside /api/v1', () => {
	expect(routeIdToSpecPath('/settings/security')).toStrictEqual(null);
	expect(routeIdToSpecPath('/api/v10/status')).toStrictEqual(null);
});

// --- getApiRequirement ---

test('getApiRequirement: reads area and access from the spec', () => {
	expect(getApiRequirement('/api/v1/databases/[id]', 'PATCH')).toStrictEqual({
		area: 'databases',
		access: 'write'
	});
	expect(getApiRequirement('/api/v1/databases', 'GET')).toStrictEqual({
		area: 'databases',
		access: 'read'
	});
});

test('getApiRequirement: ignores parameter names', () => {
	expect(getApiRequirement('/api/v1/databases/[databaseId]', 'GET')).toStrictEqual({
		area: 'databases',
		access: 'read'
	});
});

test('getApiRequirement: treats HEAD as GET', () => {
	expect(getApiRequirement('/api/v1/status', 'HEAD')).toStrictEqual({
		area: 'system',
		access: 'read'
	});
});

test('getApiRequirement: public and unknown operations have no requirement', () => {
	expect(getApiRequirement('/api/v1/health', 'GET')).toStrictEqual(null);
	expect(getApiRequirement('/api/v1/status', 'DELETE')).toStrictEqual(null);
	expect(getApiRequirement('/api/v1/nope', 'GET')).toStrictEqual(null);
});

// --- checkApiKeyAccess ---

test('checkApiKeyAccess: full access passes everything', () => {
	expect(checkApiKeyAccess(key('all'), '/api/v1/databases/[id]', 'DELETE')).toStrictEqual(null);
	expect(checkApiKeyAccess(key('all'), '/api/v1/nope', 'GET')).toStrictEqual(null);
});

test('checkApiKeyAccess: write includes read', () => {
	expect(checkApiKeyAccess(key({ databases: 'write' }), '/api/v1/databases', 'GET')).toStrictEqual(
		null
	);
});

test('checkApiKeyAccess: read does not include write', () => {
	expect(
		checkApiKeyAccess(key({ databases: 'read' }), '/api/v1/databases/[id]', 'PATCH')
	).toStrictEqual('API key does not have write access to Databases');
});

test('checkApiKeyAccess: other areas are denied', () => {
	expect(checkApiKeyAccess(key({ databases: 'write' }), '/api/v1/status', 'GET')).toStrictEqual(
		'API key does not have read access to System'
	);
});

test('checkApiKeyAccess: unlabelled operations are denied to scoped keys', () => {
	expect(checkApiKeyAccess(key({ system: 'read' }), '/api/v1/nope', 'GET')).toStrictEqual(
		'API key does not have access to this endpoint'
	);
});

// --- API_AREAS ---

test('API_AREAS: one area per spec tag, writable only where a write exists', () => {
	const areas = Object.fromEntries(API_AREAS.map((area) => [area.id, area.writable]));
	expect(areas).toStrictEqual({
		system: false,
		jobs: false,
		backups: true,
		arr: false,
		databases: true,
		announcements: false
	});
});
