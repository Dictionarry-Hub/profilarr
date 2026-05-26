import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { parseDownloadedReportCount } from '$lib/server/upgrades/commandMessages.ts';

class CommandMessagesTest extends BaseTest {
	runTests(): void {
		this.test('parses plural downloaded report count', () => {
			assertEquals(
				parseDownloadedReportCount('Completed search for 10 movies. 4 reports downloaded.'),
				4
			);
		});

		this.test('parses singular downloaded report count', () => {
			assertEquals(
				parseDownloadedReportCount('Completed search for 10 movies. 1 report downloaded.'),
				1
			);
		});

		this.test('parses zero downloaded report count', () => {
			assertEquals(
				parseDownloadedReportCount('Completed search for 10 movies. 0 reports downloaded.'),
				0
			);
		});

		this.test('returns null for missing message', () => {
			assertEquals(parseDownloadedReportCount(undefined), null);
			assertEquals(parseDownloadedReportCount(null), null);
		});

		this.test('returns null for unrecognized message', () => {
			assertEquals(parseDownloadedReportCount('Completed search for 10 movies.'), null);
		});
	}
}

const commandMessagesTest = new CommandMessagesTest();
commandMessagesTest.runTests();
