/**
 * Version detection: what `detectVersion()` reports for the answers an Arr
 * can give, and how the shared capability helper reads the stored result.
 * Sonarr v5 keeps quality size limits on quality profile items, so this is
 * what every later version-dependent decision rests on.
 */

import { describe, expect, test } from 'vitest';
import { BaseArrClient } from '#arr/base.ts';
import { HttpError } from '#utils/http/types.ts';
import type { RequestOptions } from '#utils/http/types.ts';
import {
	apiGeneration,
	hasProfileItemSizes,
	isExperimentalVersion,
	versionMajor
} from '#shared/arr/capabilities.ts';

type Routes = Record<string, unknown>;

/** Answers each path from a table; an unknown path is a 404, an Error value is thrown. */
class FakeArrClient extends BaseArrClient {
	constructor(private readonly routes: Routes) {
		super('http://arr.local', 'test-api-key');
	}

	override get<T>(path: string, _options?: RequestOptions): Promise<T> {
		const answer = this.routes[path];
		if (answer === undefined) return Promise.reject(new HttpError('HTTP 404: Not Found', 404));
		if (answer instanceof Error) return Promise.reject(answer);
		return Promise.resolve(answer as T);
	}
}

const status = (appName: string, version: string) => ({ appName, version, osName: 'alpine' });

async function detect(routes: Routes) {
	const client = new FakeArrClient(routes);
	return await client.detectVersion();
}

describe('detectVersion', () => {
	test('Sonarr v5 reports v5 as the current API', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Sonarr', '5.0.0.2569'),
			'/api': { current: 'v5', deprecated: ['v3'] }
		});
		expect(info).toStrictEqual({ appName: 'Sonarr', version: '5.0.0.2569', currentApi: 'v5' });
	});

	test('Sonarr v4 reports v3 as the current API', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Sonarr', '4.0.20.3014'),
			'/api': { current: 'v3', deprecated: [] }
		});
		expect(info.currentApi).toStrictEqual('v3');
	});

	test('a missing /api route is not an error', async () => {
		const info = await detect({ '/api/v3/system/status': status('Sonarr', '5.0.0.2569') });
		expect(info).toStrictEqual({ appName: 'Sonarr', version: '5.0.0.2569', currentApi: null });
	});

	test('an /api route that is not JSON is not an error', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Radarr', '5.2.0.1'),
			'/api': new HttpError('Unexpected token < in JSON', 0)
		});
		expect(info.currentApi).toStrictEqual(null);
	});

	test('an /api answer without a current field is treated as unknown', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Sonarr', '5.0.0.2569'),
			'/api': { current: '', deprecated: [] }
		});
		expect(info.currentApi).toStrictEqual(null);
	});

	test('an unreachable system/status throws', async () => {
		await expect(detect({ '/api': { current: 'v5', deprecated: [] } })).rejects.toThrow(HttpError);
	});
});

describe('capabilities', () => {
	test('versionMajor reads the leading number', () => {
		expect(versionMajor('5.0.0.2569')).toStrictEqual(5);
		expect(versionMajor('4.0.20.3014')).toStrictEqual(4);
		expect(versionMajor('10.0.0.0')).toStrictEqual(10);
		expect(versionMajor('')).toStrictEqual(null);
		expect(versionMajor(null)).toStrictEqual(null);
		expect(versionMajor('v5')).toStrictEqual(null);
	});

	test('apiGeneration reads v-prefixed generations only', () => {
		expect(apiGeneration('v5')).toStrictEqual(5);
		expect(apiGeneration('V3')).toStrictEqual(3);
		expect(apiGeneration('5')).toStrictEqual(null);
		expect(apiGeneration(null)).toStrictEqual(null);
	});

	test('Sonarr on API v5 keeps sizes per profile', () => {
		expect(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '5.0.0.2569', detected_api: 'v5' })
		).toStrictEqual(true);
	});

	test('Sonarr on API v3 does not', () => {
		expect(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '4.0.20.3014', detected_api: 'v3' })
		).toStrictEqual(false);
	});

	test('the reported API wins over the version major', () => {
		// A source build reports 10.0.0.x but still says which API is current
		expect(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '10.0.0.0', detected_api: 'v3' })
		).toStrictEqual(false);
	});

	test('the version major is the fallback without an /api answer', () => {
		expect(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '5.0.0.2569', detected_api: null })
		).toStrictEqual(true);
		expect(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '4.0.20.3014', detected_api: null })
		).toStrictEqual(false);
	});

	test('nothing detected yet means no capability', () => {
		expect(
			hasProfileItemSizes({ type: 'sonarr', detected_version: null, detected_api: null })
		).toStrictEqual(false);
	});

	test('Radarr never keeps sizes per profile today', () => {
		expect(
			hasProfileItemSizes({ type: 'radarr', detected_version: '5.2.0.1', detected_api: 'v5' })
		).toStrictEqual(false);
	});

	test('experimental matches the per-profile size model', () => {
		expect(
			isExperimentalVersion({ type: 'sonarr', detected_version: '5.0.0.2569', detected_api: 'v5' })
		).toStrictEqual(true);
		expect(
			isExperimentalVersion({
				type: 'sonarr',
				detected_version: '4.0.20.3014',
				detected_api: 'v3'
			})
		).toStrictEqual(false);
	});
});
