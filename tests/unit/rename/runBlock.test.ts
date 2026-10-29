import { expect } from 'vitest';
import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { renameRunBlockReason, type RenameRunState } from '#shared/rename/runBlock.ts';

const ready: RenameRunState = { hasConfig: true, dirty: false, running: false };

class RenameRunBlockTest extends BaseTest {
	runTests(): void {
		this.test('allows a run once saved and clean', () => {
			expect(renameRunBlockReason(ready)).toStrictEqual(null);
		});

		this.test('blocks a run before the config is saved', () => {
			expect(renameRunBlockReason({ ...ready, hasConfig: false })).toStrictEqual(
				'Save the config first'
			);
		});

		this.test('blocks a run while the form has unsaved changes', () => {
			expect(renameRunBlockReason({ ...ready, dirty: true })).toStrictEqual(
				'Save or discard your changes first'
			);
		});

		this.test('blocks a run while one is in progress', () => {
			expect(renameRunBlockReason({ ...ready, running: true })).toStrictEqual(
				'A rename is already running'
			);
		});

		this.test('reports the first reason that applies', () => {
			expect(renameRunBlockReason({ hasConfig: false, dirty: true, running: true })).toStrictEqual(
				'Save the config first'
			);
			expect(renameRunBlockReason({ hasConfig: true, dirty: true, running: true })).toStrictEqual(
				'Save or discard your changes first'
			);
		});
	}
}

const renameRunBlockTest = new RenameRunBlockTest();
renameRunBlockTest.runTests();
