/**
 * Tests for announcement reconciliation logic.
 */

import { BaseTest } from '#tests/unit/base/BaseTest.ts';
import { expect } from 'vitest';
import {
	ANNOUNCEMENTS_CAP,
	reconcileAnnouncements,
	UnsupportedSchemaError
} from '#server/announcements/profilarr/reconcile.ts';
import type {
	AnnouncementRow,
	BulletinAnnouncement,
	BulletinAnnouncementsFile
} from '#server/announcements/profilarr/types.ts';

function makeBulletin(overrides: Partial<BulletinAnnouncement> = {}): BulletinAnnouncement {
	return {
		id: '01HXYZ0000000000000000000A',
		title: 'Test',
		severity: 'info',
		published_at: '2026-04-01T00:00:00Z',
		expires_at: null,
		min_version: null,
		max_version: null,
		link: null,
		...overrides
	};
}

function makeRow(overrides: Partial<AnnouncementRow> = {}): AnnouncementRow {
	return {
		id: '01HXYZ0000000000000000000A',
		title: 'Test',
		severity: 'info',
		published_at: '2026-04-01T00:00:00Z',
		expires_at: null,
		min_version: null,
		max_version: null,
		link: null,
		body: null,
		withdrawn: 0,
		read_at: null,
		fetched_at: '2026-04-20T10:00:00Z',
		body_fetched_at: null,
		...overrides
	};
}

function makeFile(
	announcements: BulletinAnnouncement[],
	overrides: Partial<BulletinAnnouncementsFile> = {}
): BulletinAnnouncementsFile {
	return {
		schema: 1,
		updated_at: '2026-04-20T10:00:00Z',
		announcements,
		...overrides
	};
}

class AnnouncementReconcileTest extends BaseTest {
	runTests(): void {
		// ─── Fresh insertion ─────────────────────────────────────────────────

		this.test('inserts new ids into upserts and newlyInserted', () => {
			const file = makeFile([makeBulletin({ id: 'new-1' })]);
			const plan = reconcileAnnouncements(file, []);
			expect(plan.upserts.map((a) => a.id)).toStrictEqual(['new-1']);
			expect(plan.newlyInserted.map((a) => a.id)).toStrictEqual(['new-1']);
			expect(plan.withdrawnIds).toStrictEqual([]);
			expect(plan.unwithdrawnIds).toStrictEqual([]);
			expect(plan.droppedCount).toStrictEqual(0);
		});

		this.test('multiple new ids all go into newlyInserted', () => {
			const file = makeFile([
				makeBulletin({ id: 'a' }),
				makeBulletin({ id: 'b' }),
				makeBulletin({ id: 'c' })
			]);
			const plan = reconcileAnnouncements(file, []);
			expect(plan.newlyInserted.map((a) => a.id)).toStrictEqual(['a', 'b', 'c']);
		});

		// ─── Existing rows ───────────────────────────────────────────────────

		this.test('existing ids are upserted but not newlyInserted', () => {
			const existing = [makeRow({ id: 'existing-1' })];
			const file = makeFile([makeBulletin({ id: 'existing-1', title: 'Updated' })]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.upserts.length).toStrictEqual(1);
			expect(plan.upserts[0].title).toStrictEqual('Updated');
			expect(plan.newlyInserted).toStrictEqual([]);
		});

		this.test('mix of new and existing: only new ids in newlyInserted', () => {
			const existing = [makeRow({ id: 'a' })];
			const file = makeFile([makeBulletin({ id: 'a' }), makeBulletin({ id: 'b' })]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.upserts.map((a) => a.id).sort()).toStrictEqual(['a', 'b']);
			expect(plan.newlyInserted.map((a) => a.id)).toStrictEqual(['b']);
		});

		// ─── Withdrawal ──────────────────────────────────────────────────────

		this.test('ids absent from file are added to withdrawnIds', () => {
			const existing = [makeRow({ id: 'gone' })];
			const file = makeFile([]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.withdrawnIds).toStrictEqual(['gone']);
			expect(plan.upserts).toStrictEqual([]);
		});

		this.test('already-withdrawn rows still absent from file are not re-withdrawn', () => {
			const existing = [makeRow({ id: 'already-gone', withdrawn: 1 })];
			const file = makeFile([]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.withdrawnIds).toStrictEqual([]);
		});

		// ─── Unwithdrawal ────────────────────────────────────────────────────

		this.test('withdrawn row that reappears in file is unwithdrawn', () => {
			const existing = [makeRow({ id: 'back', withdrawn: 1 })];
			const file = makeFile([makeBulletin({ id: 'back' })]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.unwithdrawnIds).toStrictEqual(['back']);
			// A reappearing announcement should NOT be treated as newly inserted.
			expect(plan.newlyInserted).toStrictEqual([]);
		});

		this.test('non-withdrawn row still in file does not appear in unwithdrawnIds', () => {
			const existing = [makeRow({ id: 'stable', withdrawn: 0 })];
			const file = makeFile([makeBulletin({ id: 'stable' })]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.unwithdrawnIds).toStrictEqual([]);
		});

		// ─── Schema rejection ────────────────────────────────────────────────

		this.test('schema != 1 throws UnsupportedSchemaError', () => {
			const file = makeFile([], { schema: 2 });
			expect(() => reconcileAnnouncements(file, [])).toThrow(UnsupportedSchemaError);
			expect(() => reconcileAnnouncements(file, [])).toThrow(
				'Unsupported announcements schema version: 2'
			);
		});

		this.test('schema === 1 is accepted', () => {
			const file = makeFile([], { schema: 1 });
			const plan = reconcileAnnouncements(file, []);
			expect(plan.upserts).toStrictEqual([]);
		});

		// ─── Overflow cap ────────────────────────────────────────────────────

		this.test('payloads beyond the cap are truncated with droppedCount', () => {
			const announcements: BulletinAnnouncement[] = [];
			for (let i = 0; i < ANNOUNCEMENTS_CAP + 5; i++) {
				announcements.push(makeBulletin({ id: `id-${i}` }));
			}
			const plan = reconcileAnnouncements(makeFile(announcements), []);
			expect(plan.upserts.length).toStrictEqual(ANNOUNCEMENTS_CAP);
			expect(plan.droppedCount).toStrictEqual(5);
		});

		this.test('payloads at the cap are not truncated', () => {
			const announcements: BulletinAnnouncement[] = [];
			for (let i = 0; i < ANNOUNCEMENTS_CAP; i++) {
				announcements.push(makeBulletin({ id: `id-${i}` }));
			}
			const plan = reconcileAnnouncements(makeFile(announcements), []);
			expect(plan.upserts.length).toStrictEqual(ANNOUNCEMENTS_CAP);
			expect(plan.droppedCount).toStrictEqual(0);
		});

		// ─── Combined scenarios ──────────────────────────────────────────────

		this.test('full mix: insert + update + withdraw + unwithdraw in one plan', () => {
			const existing = [
				makeRow({ id: 'keep' }),
				makeRow({ id: 'withdraw-me' }),
				makeRow({ id: 'returning', withdrawn: 1 })
			];
			const file = makeFile([
				makeBulletin({ id: 'keep', title: 'Updated' }),
				makeBulletin({ id: 'returning' }),
				makeBulletin({ id: 'brand-new' })
			]);
			const plan = reconcileAnnouncements(file, existing);
			expect(plan.upserts.map((a) => a.id).sort()).toStrictEqual([
				'brand-new',
				'keep',
				'returning'
			]);
			expect(plan.withdrawnIds).toStrictEqual(['withdraw-me']);
			expect(plan.unwithdrawnIds).toStrictEqual(['returning']);
			expect(plan.newlyInserted.map((a) => a.id)).toStrictEqual(['brand-new']);
		});
	}
}

const suite = new AnnouncementReconcileTest();
suite.runTests();
