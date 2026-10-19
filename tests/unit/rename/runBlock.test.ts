import { assertEquals } from '@std/assert';
import { BaseTest } from '../base/BaseTest.ts';
import { renameRunBlockReason, type RenameRunState } from '$shared/rename/runBlock.ts';

const ready: RenameRunState = { hasConfig: true, dirty: false, running: false };

class RenameRunBlockTest extends BaseTest {
	runTests(): void {
		this.test('allows a run once saved and clean', () => {
			assertEquals(renameRunBlockReason(ready), null);
		});

		this.test('blocks a run before the config is saved', () => {
			assertEquals(renameRunBlockReason({ ...ready, hasConfig: false }), 'Save the config first');
		});

		this.test('blocks a run while the form has unsaved changes', () => {
			assertEquals(
				renameRunBlockReason({ ...ready, dirty: true }),
				'Save or discard your changes first'
			);
		});

		this.test('blocks a run while one is in progress', () => {
			assertEquals(
				renameRunBlockReason({ ...ready, running: true }),
				'A rename is already running'
			);
		});

		this.test('reports the first reason that applies', () => {
			assertEquals(
				renameRunBlockReason({ hasConfig: false, dirty: true, running: true }),
				'Save the config first'
			);
			assertEquals(
				renameRunBlockReason({ hasConfig: true, dirty: true, running: true }),
				'Save or discard your changes first'
			);
		});
	}
}

const renameRunBlockTest = new RenameRunBlockTest();
renameRunBlockTest.runTests();
