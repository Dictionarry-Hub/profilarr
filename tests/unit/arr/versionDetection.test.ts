/**
 * Version detection: what `detectVersion()` reports for the answers an Arr
 * can give, and how the shared capability helper reads the stored result.
 * Sonarr v5 keeps quality size limits on quality profile items, so this is
 * what every later version-dependent decision rests on.
 */

import { assertEquals, assertRejects } from '@std/assert';
import { BaseArrClient } from '$arr/base.ts';
import { HttpError } from '$utils/http/types.ts';
import type { RequestOptions } from '$utils/http/types.ts';
import {
	apiGeneration,
	hasProfileItemSizes,
	isExperimentalVersion,
	versionMajor
} from '$shared/arr/capabilities.ts';

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

Deno.test('detectVersion', async (t) => {
	await t.step('Sonarr v5 reports v5 as the current API', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Sonarr', '5.0.0.2569'),
			'/api': { current: 'v5', deprecated: ['v3'] }
		});
		assertEquals(info, { appName: 'Sonarr', version: '5.0.0.2569', currentApi: 'v5' });
	});

	await t.step('Sonarr v4 reports v3 as the current API', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Sonarr', '4.0.20.3014'),
			'/api': { current: 'v3', deprecated: [] }
		});
		assertEquals(info.currentApi, 'v3');
	});

	await t.step('a missing /api route is not an error', async () => {
		const info = await detect({ '/api/v3/system/status': status('Sonarr', '5.0.0.2569') });
		assertEquals(info, { appName: 'Sonarr', version: '5.0.0.2569', currentApi: null });
	});

	await t.step('an /api route that is not JSON is not an error', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Radarr', '5.2.0.1'),
			'/api': new HttpError('Unexpected token < in JSON', 0)
		});
		assertEquals(info.currentApi, null);
	});

	await t.step('an /api answer without a current field is treated as unknown', async () => {
		const info = await detect({
			'/api/v3/system/status': status('Sonarr', '5.0.0.2569'),
			'/api': { current: '', deprecated: [] }
		});
		assertEquals(info.currentApi, null);
	});

	await t.step('an unreachable system/status throws', async () => {
		await assertRejects(() => detect({ '/api': { current: 'v5', deprecated: [] } }), HttpError);
	});
});

Deno.test('capabilities', async (t) => {
	await t.step('versionMajor reads the leading number', () => {
		assertEquals(versionMajor('5.0.0.2569'), 5);
		assertEquals(versionMajor('4.0.20.3014'), 4);
		assertEquals(versionMajor('10.0.0.0'), 10);
		assertEquals(versionMajor(''), null);
		assertEquals(versionMajor(null), null);
		assertEquals(versionMajor('v5'), null);
	});

	await t.step('apiGeneration reads v-prefixed generations only', () => {
		assertEquals(apiGeneration('v5'), 5);
		assertEquals(apiGeneration('V3'), 3);
		assertEquals(apiGeneration('5'), null);
		assertEquals(apiGeneration(null), null);
	});

	await t.step('Sonarr on API v5 keeps sizes per profile', () => {
		assertEquals(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '5.0.0.2569', detected_api: 'v5' }),
			true
		);
	});

	await t.step('Sonarr on API v3 does not', () => {
		assertEquals(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '4.0.20.3014', detected_api: 'v3' }),
			false
		);
	});

	await t.step('the reported API wins over the version major', () => {
		// A source build reports 10.0.0.x but still says which API is current
		assertEquals(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '10.0.0.0', detected_api: 'v3' }),
			false
		);
	});

	await t.step('the version major is the fallback without an /api answer', () => {
		assertEquals(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '5.0.0.2569', detected_api: null }),
			true
		);
		assertEquals(
			hasProfileItemSizes({ type: 'sonarr', detected_version: '4.0.20.3014', detected_api: null }),
			false
		);
	});

	await t.step('nothing detected yet means no capability', () => {
		assertEquals(
			hasProfileItemSizes({ type: 'sonarr', detected_version: null, detected_api: null }),
			false
		);
	});

	await t.step('Radarr never keeps sizes per profile today', () => {
		assertEquals(
			hasProfileItemSizes({ type: 'radarr', detected_version: '5.2.0.1', detected_api: 'v5' }),
			false
		);
	});

	await t.step('experimental matches the per-profile size model', () => {
		assertEquals(
			isExperimentalVersion({ type: 'sonarr', detected_version: '5.0.0.2569', detected_api: 'v5' }),
			true
		);
		assertEquals(
			isExperimentalVersion({
				type: 'sonarr',
				detected_version: '4.0.20.3014',
				detected_api: 'v3'
			}),
			false
		);
	});
});
