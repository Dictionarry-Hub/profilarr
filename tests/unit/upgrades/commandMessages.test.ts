import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { parseDownloadedReportCount } from '#server/upgrades/commandMessages.ts';

class CommandMessagesTest extends BaseTest {
	runTests(): void {
		this.test('parses plural downloaded report count', () => {
			expect(
				parseDownloadedReportCount('Completed search for 10 movies. 4 reports downloaded.')
			).toStrictEqual(4);
		});

		this.test('parses singular downloaded report count', () => {
			expect(
				parseDownloadedReportCount('Completed search for 10 movies. 1 report downloaded.')
			).toStrictEqual(1);
		});

		this.test('parses zero downloaded report count', () => {
			expect(
				parseDownloadedReportCount('Completed search for 10 movies. 0 reports downloaded.')
			).toStrictEqual(0);
		});

		this.test('returns null for missing message', () => {
			expect(parseDownloadedReportCount(undefined)).toStrictEqual(null);
			expect(parseDownloadedReportCount(null)).toStrictEqual(null);
		});

		this.test('returns null for unrecognized message', () => {
			expect(parseDownloadedReportCount('Completed search for 10 movies.')).toStrictEqual(null);
		});
	}
}

const commandMessagesTest = new CommandMessagesTest();
commandMessagesTest.runTests();
