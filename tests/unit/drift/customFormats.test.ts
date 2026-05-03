import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { compareCustomFormatDrift, type CustomFormatDriftDiff } from '$drift/customFormats.ts';
import { hashDriftDiff } from '$drift/hash.ts';
import type { ArrCustomFormat } from '$sync/customFormats/transformer.ts';

function customFormat(input: Partial<ArrCustomFormat> & { name: string }): ArrCustomFormat {
	return {
		name: input.name,
		includeCustomFormatWhenRenaming: input.includeCustomFormatWhenRenaming,
		specifications: input.specifications ?? [
			{
				name: 'Title Match',
				implementation: 'ReleaseTitleSpecification',
				negate: false,
				required: true,
				fields: [{ name: 'value', value: 'AMZN' }]
			}
		]
	};
}

class CustomFormatDriftTest extends BaseTest {
	runTests(): void {
		this.test('clean when expected and actual custom formats match', () => {
			const result = compareCustomFormatDrift(
				[customFormat({ name: 'Streaming Tier' })],
				[customFormat({ name: 'Streaming Tier' })]
			);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { missing: [], modified: [] });
		});

		this.test('ignores arr ids', () => {
			const result = compareCustomFormatDrift(
				[customFormat({ name: 'Streaming Tier', id: 1 })],
				[customFormat({ name: 'Streaming Tier', id: 999 })]
			);

			assertEquals(result.count, 0);
		});

		this.test('reports missing expected custom format', () => {
			const result = compareCustomFormatDrift([customFormat({ name: 'Streaming Tier' })], []);

			assertEquals(result.count, 1);
			assertEquals(result.diff.missing, [{ name: 'Streaming Tier' }]);
			assertEquals(result.diff.modified, []);
		});

		this.test('reports include in rename mismatch', () => {
			const result = compareCustomFormatDrift(
				[customFormat({ name: 'Streaming Tier', includeCustomFormatWhenRenaming: true })],
				[customFormat({ name: 'Streaming Tier', includeCustomFormatWhenRenaming: false })]
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'Streaming Tier',
					fields: [
						{
							path: 'includeCustomFormatWhenRenaming',
							expected: true,
							actual: false
						}
					]
				}
			]);
		});

		this.test('ignores specification order', () => {
			const first = {
				name: 'Title Match',
				implementation: 'ReleaseTitleSpecification',
				negate: false,
				required: true,
				fields: [{ name: 'value', value: 'AMZN' }]
			};
			const second = {
				name: 'Group Match',
				implementation: 'ReleaseGroupSpecification',
				negate: false,
				required: false,
				fields: [{ name: 'value', value: 'GROUP' }]
			};

			const result = compareCustomFormatDrift(
				[customFormat({ name: 'Streaming Tier', specifications: [first, second] })],
				[customFormat({ name: 'Streaming Tier', specifications: [second, first] })]
			);

			assertEquals(result.count, 0);
		});

		this.test('ignores field order', () => {
			const result = compareCustomFormatDrift(
				[
					customFormat({
						name: 'Size Tier',
						specifications: [
							{
								name: 'Size',
								implementation: 'SizeSpecification',
								negate: false,
								required: true,
								fields: [
									{ name: 'min', value: 1 },
									{ name: 'max', value: 2 }
								]
							}
						]
					})
				],
				[
					customFormat({
						name: 'Size Tier',
						specifications: [
							{
								name: 'Size',
								implementation: 'SizeSpecification',
								negate: false,
								required: true,
								fields: [
									{ name: 'max', value: 2 },
									{ name: 'min', value: 1 }
								]
							}
						]
					})
				]
			);

			assertEquals(result.count, 0);
		});

		this.test('treats missing optional false fields as clean', () => {
			const result = compareCustomFormatDrift(
				[
					customFormat({
						name: 'Not Original or English',
						specifications: [
							{
								name: 'English',
								implementation: 'LanguageSpecification',
								negate: true,
								required: false,
								fields: [{ name: 'value', value: 1 }]
							}
						]
					})
				],
				[
					customFormat({
						name: 'Not Original or English',
						specifications: [
							{
								name: 'English',
								implementation: 'LanguageSpecification',
								negate: true,
								required: false,
								fields: [
									{ name: 'value', value: 1 },
									{ name: 'exceptLanguage', value: false }
								]
							}
						]
					})
				]
			);

			assertEquals(result.count, 0);
		});

		this.test('reports optional true fields missing from expected', () => {
			const result = compareCustomFormatDrift(
				[
					customFormat({
						name: 'Not Original or English',
						specifications: [
							{
								name: 'English',
								implementation: 'LanguageSpecification',
								negate: true,
								required: false,
								fields: [{ name: 'value', value: 1 }]
							}
						]
					})
				],
				[
					customFormat({
						name: 'Not Original or English',
						specifications: [
							{
								name: 'English',
								implementation: 'LanguageSpecification',
								negate: true,
								required: false,
								fields: [
									{ name: 'value', value: 1 },
									{ name: 'exceptLanguage', value: true }
								]
							}
						]
					})
				]
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'Not Original or English',
					fields: [
						{
							path: 'specifications[LanguageSpecification:English].fields[exceptLanguage]',
							expected: null,
							actual: true
						}
					]
				}
			]);
		});

		this.test('reports field value mismatch with stable path', () => {
			const result = compareCustomFormatDrift(
				[customFormat({ name: 'Streaming Tier' })],
				[
					customFormat({
						name: 'Streaming Tier',
						specifications: [
							{
								name: 'Title Match',
								implementation: 'ReleaseTitleSpecification',
								negate: false,
								required: true,
								fields: [{ name: 'value', value: 'NF' }]
							}
						]
					})
				]
			);

			assertEquals(result.count, 1);
			assertEquals(result.diff.modified, [
				{
					name: 'Streaming Tier',
					fields: [
						{
							path: 'specifications[ReleaseTitleSpecification:Title Match].fields[value]',
							expected: 'AMZN',
							actual: 'NF'
						}
					]
				}
			]);
		});

		this.test('ignores unmanaged extra arr custom format', () => {
			const result = compareCustomFormatDrift(
				[customFormat({ name: 'Streaming Tier' })],
				[customFormat({ name: 'Streaming Tier' }), customFormat({ name: 'Unmanaged' })]
			);

			assertEquals(result.count, 0);
		});

		this.test('hash is stable for equivalent object key order', async () => {
			const first: CustomFormatDriftDiff = {
				missing: [],
				modified: [
					{
						name: 'Streaming Tier',
						fields: [
							{
								path: 'includeCustomFormatWhenRenaming',
								expected: true,
								actual: false
							}
						]
					}
				]
			};
			const second = {
				modified: [
					{
						fields: [
							{
								actual: false,
								expected: true,
								path: 'includeCustomFormatWhenRenaming'
							}
						],
						name: 'Streaming Tier'
					}
				],
				missing: []
			};

			assertEquals(
				await hashDriftDiff({ custom_formats: first }),
				await hashDriftDiff({ custom_formats: second })
			);
		});

		this.test('clean with no expected custom formats', () => {
			const result = compareCustomFormatDrift([], [customFormat({ name: 'Unmanaged' })]);

			assertEquals(result.count, 0);
			assertEquals(result.diff, { missing: [], modified: [] });
		});
	}
}

const customFormatDriftTest = new CustomFormatDriftTest();
customFormatDriftTest.runTests();
