/**
 * Tests for announcement visibility logic.
 */

import { BaseTest } from '../base/BaseTest.ts';
import { assertEquals } from '@std/assert';
import {
	compareVersions,
	isVisible,
	satisfiesRange,
	type VisibilityContext
} from '../../../src/lib/server/announcements/filter.ts';
import type { AnnouncementRecord } from '../../../src/lib/server/announcements/types.ts';

function makeAnnouncement(overrides: Partial<AnnouncementRecord> = {}): AnnouncementRecord {
	return {
		id: '01HXYZ0000000000000000000A',
		title: 'Test',
		severity: 'info',
		publishedAt: '2026-04-01T00:00:00Z',
		expiresAt: null,
		minVersion: null,
		maxVersion: null,
		link: null,
		body: null,
		withdrawn: false,
		readAt: null,
		fetchedAt: '2026-04-20T10:00:00Z',
		bodyFetchedAt: null,
		...overrides
	};
}

function makeCtx(overrides: Partial<VisibilityContext> = {}): VisibilityContext {
	return {
		now: '2026-04-20T10:00:00Z',
		version: '2.3.0',
		channel: 'stable',
		...overrides
	};
}

class AnnouncementFilterTest extends BaseTest {
	runTests(): void {
		// ─── compareVersions ──────────────────────────────────────────────────

		this.test('compareVersions: equal returns 0', () => {
			assertEquals(compareVersions('2.3.0', '2.3.0'), 0);
		});

		this.test('compareVersions: smaller patch returns -1', () => {
			assertEquals(compareVersions('2.3.0', '2.3.1'), -1);
		});

		this.test('compareVersions: larger minor returns 1', () => {
			assertEquals(compareVersions('2.4.0', '2.3.9'), 1);
		});

		this.test('compareVersions: ignores prerelease suffix', () => {
			assertEquals(compareVersions('2.3.0-rc.1', '2.3.0'), 0);
		});

		this.test('compareVersions: missing components treated as zero', () => {
			assertEquals(compareVersions('2', '2.0.0'), 0);
			assertEquals(compareVersions('2.1', '2.0.9'), 1);
		});

		// ─── satisfiesRange ──────────────────────────────────────────────────

		this.test('satisfiesRange: null bounds always satisfy', () => {
			assertEquals(satisfiesRange('2.3.0', null, null), true);
		});

		this.test('satisfiesRange: current above min', () => {
			assertEquals(satisfiesRange('2.3.0', '2.0.0', null), true);
		});

		this.test('satisfiesRange: current below min rejected', () => {
			assertEquals(satisfiesRange('1.9.0', '2.0.0', null), false);
		});

		this.test('satisfiesRange: current above max rejected', () => {
			assertEquals(satisfiesRange('2.5.0', null, '2.4.0'), false);
		});

		this.test('satisfiesRange: current inside range', () => {
			assertEquals(satisfiesRange('2.3.0', '2.0.0', '2.4.0'), true);
		});

		this.test('satisfiesRange: inclusive at min boundary', () => {
			assertEquals(satisfiesRange('2.0.0', '2.0.0', null), true);
		});

		this.test('satisfiesRange: inclusive at max boundary', () => {
			assertEquals(satisfiesRange('2.4.0', null, '2.4.0'), true);
		});

		// ─── isVisible: withdrawn ────────────────────────────────────────────

		this.test('withdrawn announcements are never visible', () => {
			const a = makeAnnouncement({ withdrawn: true });
			assertEquals(isVisible(a, makeCtx()), false);
		});

		// ─── isVisible: expiry ───────────────────────────────────────────────

		this.test('expired announcements are hidden', () => {
			const a = makeAnnouncement({ expiresAt: '2026-04-01T00:00:00Z' });
			assertEquals(isVisible(a, makeCtx({ now: '2026-04-20T10:00:00Z' })), false);
		});

		this.test('unexpired (future expiry) is visible', () => {
			const a = makeAnnouncement({ expiresAt: '2026-05-01T00:00:00Z' });
			assertEquals(isVisible(a, makeCtx({ now: '2026-04-20T10:00:00Z' })), true);
		});

		this.test('null expiry is visible', () => {
			const a = makeAnnouncement({ expiresAt: null });
			assertEquals(isVisible(a, makeCtx()), true);
		});

		// ─── isVisible: version bounds ───────────────────────────────────────

		this.test('below min_version is hidden', () => {
			const a = makeAnnouncement({ minVersion: '2.5.0' });
			assertEquals(isVisible(a, makeCtx({ version: '2.3.0' })), false);
		});

		this.test('above max_version is hidden', () => {
			const a = makeAnnouncement({ maxVersion: '2.2.0' });
			assertEquals(isVisible(a, makeCtx({ version: '2.3.0' })), false);
		});

		this.test('within bounds is visible', () => {
			const a = makeAnnouncement({ minVersion: '2.0.0', maxVersion: '2.4.0' });
			assertEquals(isVisible(a, makeCtx({ version: '2.3.0' })), true);
		});

		// ─── isVisible: dev channel bypass ───────────────────────────────────

		this.test('dev channel ignores version bounds', () => {
			const a = makeAnnouncement({ minVersion: '9.0.0', maxVersion: '9.0.0' });
			assertEquals(isVisible(a, makeCtx({ version: 'dev', channel: 'dev' })), true);
		});

		this.test('version with prerelease suffix bypasses bounds', () => {
			const a = makeAnnouncement({ minVersion: '9.0.0' });
			assertEquals(isVisible(a, makeCtx({ version: '2.3.0-rc.1', channel: 'stable' })), true);
		});

		this.test('dev channel still respects expiry', () => {
			const a = makeAnnouncement({ expiresAt: '2026-01-01T00:00:00Z' });
			assertEquals(
				isVisible(a, makeCtx({ channel: 'dev', version: 'dev', now: '2026-04-20T10:00:00Z' })),
				false
			);
		});

		this.test('dev channel still respects withdrawn', () => {
			const a = makeAnnouncement({ withdrawn: true });
			assertEquals(isVisible(a, makeCtx({ channel: 'dev', version: 'dev' })), false);
		});
	}
}

const suite = new AnnouncementFilterTest();
suite.runTests();
