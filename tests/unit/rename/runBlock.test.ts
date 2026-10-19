import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import {
	LIVE_RUN_DISABLED_REASON,
	renameRunBlockReason,
	type RenameRunState
} from '$shared/rename/runBlock.ts';

const ready: RenameRunState = {
	hasConfig: true,
	dirty: false,
	running: false,
	enabled: true,
	dryRun: false
};

class RenameRunBlockTest extends BaseTest {
	runTests(): void {
		this.test('allows a live run once saved, clean and enabled', () => {
			assertEquals(renameRunBlockReason(ready), null);
		});

		this.test('allows a dry run while renaming is disabled', () => {
			assertEquals(renameRunBlockReason({ ...ready, enabled: false, dryRun: true }), null);
		});

		this.test('blocks a live run while renaming is disabled', () => {
			assertEquals(renameRunBlockReason({ ...ready, enabled: false }), LIVE_RUN_DISABLED_REASON);
		});

		this.test('blocks both runs before the config is saved', () => {
			for (const dryRun of [true, false]) {
				assertEquals(
					renameRunBlockReason({ ...ready, hasConfig: false, dryRun }),
					'Save the config first'
				);
			}
		});

		this.test('blocks both runs while the form has unsaved changes', () => {
			for (const dryRun of [true, false]) {
				assertEquals(
					renameRunBlockReason({ ...ready, dirty: true, dryRun }),
					'Save or discard your changes first'
				);
			}
		});

		this.test('blocks both runs while a run is in progress', () => {
			for (const dryRun of [true, false]) {
				assertEquals(
					renameRunBlockReason({ ...ready, running: true, dryRun }),
					'A rename is already running'
				);
			}
		});

		this.test('reports the first reason that applies', () => {
			const blocked = { hasConfig: false, dirty: true, running: true, enabled: false };
			assertEquals(
				renameRunBlockReason({ ...blocked, dryRun: false }),
				'Save the config first'
			);
			assertEquals(
				renameRunBlockReason({ ...blocked, hasConfig: true, dryRun: false }),
				'Save or discard your changes first'
			);
			assertEquals(
				renameRunBlockReason({ ...blocked, hasConfig: true, dirty: false, dryRun: false }),
				'A rename is already running'
			);
		});
	}
}

const renameRunBlockTest = new RenameRunBlockTest();
renameRunBlockTest.runTests();
