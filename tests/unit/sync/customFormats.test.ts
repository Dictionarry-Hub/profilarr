import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { transformCustomFormat, type PcdCustomFormat } from '$sync/customFormats/transformer.ts';

function customFormat(conditions: PcdCustomFormat['conditions']): PcdCustomFormat {
	return {
		id: 1,
		name: 'Size Format',
		includeInRename: false,
		conditions
	};
}

class CustomFormatTransformerTest extends BaseTest {
	runTests(): void {
		this.test('converts stored size bytes to Arr GB fields', () => {
			const result = transformCustomFormat(
				customFormat([
					{
						name: 'Size',
						type: 'size',
						arrType: 'all',
						negate: false,
						required: false,
						size: {
							minBytes: 1024 * 1024 * 1024,
							maxBytes: 2 * 1024 * 1024 * 1024
						}
					}
				]),
				'radarr'
			);

			assertEquals(result.specifications, [
				{
					name: 'Size',
					implementation: 'SizeSpecification',
					negate: false,
					required: false,
					fields: [
						{ name: 'min', value: 1 },
						{ name: 'max', value: 2 }
					]
				}
			]);
		});

		this.test('keeps empty size bounds as Arr zero fields', () => {
			const result = transformCustomFormat(
				customFormat([
					{
						name: 'Size',
						type: 'size',
						arrType: 'all',
						negate: false,
						required: false,
						size: {
							minBytes: null,
							maxBytes: null
						}
					}
				]),
				'sonarr'
			);

			assertEquals(result.specifications[0].fields, [
				{ name: 'min', value: 0 },
				{ name: 'max', value: 0 }
			]);
		});
	}
}

const test = new CustomFormatTransformerTest();
test.runTests();
