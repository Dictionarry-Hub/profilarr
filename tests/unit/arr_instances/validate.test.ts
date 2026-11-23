import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import {
	validateCreateInstanceInput,
	validateUpdateInstanceInput
} from '#server/arr_instances/validate.ts';

const VALID_CREATE = {
	name: 'Sonarr',
	type: 'sonarr',
	url: 'http://127.0.0.1:8989',
	api_key: 'key'
};

class InstanceInputTest extends BaseTest {
	runTests(): void {
		this.test('create trims fields and defaults the optional ones', () => {
			const result = validateCreateInstanceInput({ ...VALID_CREATE, name: '  Sonarr  ' });
			expect(result).toStrictEqual({
				ok: true,
				input: {
					name: 'Sonarr',
					type: 'sonarr',
					url: 'http://127.0.0.1:8989',
					externalUrl: null,
					apiKey: 'key',
					basicAuthUsername: null,
					basicAuthPassword: null,
					tags: []
				}
			});
		});

		this.test('create rejects missing required fields', () => {
			for (const field of ['name', 'url', 'api_key']) {
				const body: Record<string, unknown> = { ...VALID_CREATE };
				delete body[field];
				expect(validateCreateInstanceInput(body).ok).toStrictEqual(false);
			}
		});

		this.test('create rejects types other than radarr and sonarr', () => {
			expect(validateCreateInstanceInput({ ...VALID_CREATE, type: 'lidarr' }).ok).toStrictEqual(
				false
			);
		});

		this.test('create rejects half a Basic Auth pair', () => {
			expect(
				validateCreateInstanceInput({ ...VALID_CREATE, basic_auth_username: 'u' }).ok
			).toStrictEqual(false);
			expect(
				validateCreateInstanceInput({ ...VALID_CREATE, basic_auth_password: 'p' }).ok
			).toStrictEqual(false);
		});

		this.test('create rejects tags that are not strings', () => {
			expect(validateCreateInstanceInput({ ...VALID_CREATE, tags: [1] }).ok).toStrictEqual(false);
		});

		this.test('update rejects an empty body and a type change', () => {
			expect(validateUpdateInstanceInput({}).ok).toStrictEqual(false);
			expect(validateUpdateInstanceInput({ type: 'radarr' }).ok).toStrictEqual(false);
		});

		this.test('update leaves out fields that were not sent', () => {
			expect(validateUpdateInstanceInput({ name: 'New' })).toStrictEqual({
				ok: true,
				input: { name: 'New' }
			});
		});

		this.test('update clears nullable fields with null or an empty string', () => {
			expect(
				validateUpdateInstanceInput({ external_url: null, basic_auth_username: '' })
			).toStrictEqual({
				ok: true,
				input: { externalUrl: null, basicAuthUsername: null }
			});
		});

		this.test('update rejects empty required fields', () => {
			for (const field of ['name', 'url', 'api_key']) {
				expect(validateUpdateInstanceInput({ [field]: '  ' }).ok).toStrictEqual(false);
			}
		});

		this.test('update validates library_refresh_interval', () => {
			expect(validateUpdateInstanceInput({ library_refresh_interval: 30 }).ok).toStrictEqual(true);
			expect(validateUpdateInstanceInput({ library_refresh_interval: -1 }).ok).toStrictEqual(false);
			expect(validateUpdateInstanceInput({ library_refresh_interval: 1.5 }).ok).toStrictEqual(
				false
			);
			expect(validateUpdateInstanceInput({ library_refresh_interval: '5' }).ok).toStrictEqual(
				false
			);
		});
	}
}

const instanceInputTest = new InstanceInputTest();
instanceInputTest.runTests();
