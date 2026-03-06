/**
 * Tests for rename processor
 * Uses hardcoded data from Bruno API testing against real Radarr/Sonarr instances.
 * Tests the processing logic (dry run, live run, error handling) without a DB or API server.
 */

import { BaseTest } from '../base/BaseTest.ts';
import { assertEquals } from '@std/assert';
import type { ArrCommand, ArrTag, RenamePreviewItem } from '$lib/server/utils/arr/types.ts';
import type { RenameSettings } from '$db/queries/arrRenameSettings.ts';
import type { ArrInstance } from '$db/queries/arrInstances.ts';
import type { LibrarySnapshot } from '$lib/server/rename/types.ts';
import {
	parseRenamedCount,
	groupByRootFolder,
	createLog,
	processDryRun,
	processFileRename,
	processFolderRename,
	diffSnapshots
} from '$lib/server/rename/core.ts';
import type { RenameAdapter, LibraryItem } from '$lib/server/rename/core.ts';

// =========================================================================
// Test fixtures — hardcoded from Bruno API testing
// =========================================================================

/** Radarr movie 1422 "28 Years Later" */
const RADARR_MOVIE: LibraryItem = {
	id: 1422,
	title: '28 Years Later',
	tags: [],
	rootFolderPath: '/data/media/movies'
};

/** Sonarr series 77 "A Knight of the Seven Kingdoms" */
const SONARR_SERIES: LibraryItem = {
	id: 77,
	title: 'A Knight of the Seven Kingdoms',
	tags: [],
	rootFolderPath: '/data/media/tv'
};

/** Tagged item that should be filtered out */
const TAGGED_MOVIE: LibraryItem = {
	id: 999,
	title: 'Tagged Movie',
	tags: [1],
	rootFolderPath: '/data/media/movies'
};

/** Item in a different root folder */
const ALT_ROOT_MOVIE: LibraryItem = {
	id: 500,
	title: 'Alt Root Movie',
	tags: [],
	rootFolderPath: '/data/media/movies-4k'
};

const TAGS: ArrTag[] = [{ id: 1, label: 'profilarr-ignore' }];

/** Radarr rename preview — 1 file needs renaming */
const RADARR_PREVIEW: RenamePreviewItem[] = [
	{
		movieId: 1422,
		movieFileId: 1399,
		existingPath: '28 Years Later (2025)/28 Years Later (2025).mkv',
		newPath: '28 Years Later (2025)/28 Years Latera (2025).mkv'
	}
];

/** Sonarr rename preview — 6 episodes need renaming */
const SONARR_PREVIEW: RenamePreviewItem[] = [
	{
		seriesId: 77,
		seasonNumber: 1,
		episodeNumbers: [1],
		episodeFileId: 1001,
		existingPath: 'Season 01/A Knight of the Seven Kingdoms - S01E01 - The Hedge Knight.mkv',
		newPath: 'Season 01a/A Knight of the Seven Kingdomsa - S01E01 - The Hedge Knight.mkv'
	},
	{
		seriesId: 77,
		seasonNumber: 1,
		episodeNumbers: [2],
		episodeFileId: 1002,
		existingPath: 'Season 01/A Knight of the Seven Kingdoms - S01E02 - The Plea.mkv',
		newPath: 'Season 01a/A Knight of the Seven Kingdomsa - S01E02 - The Plea.mkv'
	},
	{
		seriesId: 77,
		seasonNumber: 1,
		episodeNumbers: [3],
		episodeFileId: 1003,
		existingPath: 'Season 01/A Knight of the Seven Kingdoms - S01E03 - The Pupil.mkv',
		newPath: 'Season 01a/A Knight of the Seven Kingdomsa - S01E03 - The Pupil.mkv'
	},
	{
		seriesId: 77,
		seasonNumber: 1,
		episodeNumbers: [4],
		episodeFileId: 1004,
		existingPath: 'Season 01/A Knight of the Seven Kingdoms - S01E04 - The Trial.mkv',
		newPath: 'Season 01a/A Knight of the Seven Kingdomsa - S01E04 - The Trial.mkv'
	},
	{
		seriesId: 77,
		seasonNumber: 1,
		episodeNumbers: [5],
		episodeFileId: 1005,
		existingPath: 'Season 01/A Knight of the Seven Kingdoms - S01E05 - The Tourney.mkv',
		newPath: 'Season 01a/A Knight of the Seven Kingdomsa - S01E05 - The Tourney.mkv'
	},
	{
		seriesId: 77,
		seasonNumber: 1,
		episodeNumbers: [6],
		episodeFileId: 1006,
		existingPath: 'Season 01/A Knight of the Seven Kingdoms - S01E06 - The Mystery Knight.mkv',
		newPath: 'Season 01a/A Knight of the Seven Kingdomsa - S01E06 - The Mystery Knight.mkv'
	}
];

/** Completed rename command for Radarr (1 file renamed) */
const RADARR_COMMAND_RESULT: ArrCommand = {
	id: 12345,
	name: 'RenameMovie',
	commandName: 'RenameMovie',
	status: 'completed',
	message: '1 movie files renamed for 28 Years Later'
};

/** Completed rename command for Sonarr (6 files renamed) */
const SONARR_COMMAND_RESULT: ArrCommand = {
	id: 67890,
	name: 'RenameSeries',
	commandName: 'RenameSeries',
	status: 'completed',
	message: '6 episode files renamed for A Knight of the Seven Kingdoms'
};

/** No-op command (already renamed) */
const NOOP_COMMAND_RESULT: ArrCommand = {
	id: 11111,
	name: 'RenameMovie',
	commandName: 'RenameMovie',
	status: 'completed',
	message: '0 movie files renamed'
};

// =========================================================================
// Mock settings and instance
// =========================================================================

function makeSettings(overrides: Partial<RenameSettings> = {}): RenameSettings {
	return {
		id: 1,
		arrInstanceId: 1,
		renameFolders: false,
		ignoreTag: null,
		summaryNotifications: false,
		enabled: true,
		cron: '0 0 * * *',
		nextRunAt: null,
		lastRunAt: null,
		createdAt: '2025-01-01T00:00:00Z',
		updatedAt: '2025-01-01T00:00:00Z',
		...overrides
	};
}

function makeInstance(overrides: Partial<ArrInstance> = {}): ArrInstance {
	return {
		id: 1,
		name: 'Test Radarr',
		type: 'radarr',
		url: 'http://localhost:7878',
		api_key: 'test-key',
		tags: null,
		enabled: 1,
		library_refresh_interval: 60,
		library_last_refreshed_at: null,
		created_at: '2025-01-01T00:00:00Z',
		updated_at: '2025-01-01T00:00:00Z',
		...overrides
	};
}

// =========================================================================
// Mock adapter factory
// =========================================================================

interface MockAdapterOptions {
	items?: LibraryItem[];
	tags?: ArrTag[];
	previews?: Map<number, RenamePreviewItem[]>;
	renameResult?: ArrCommand;
	waitResult?: ArrCommand;
	renameThrows?: Error;
	folderRenameThrows?: Error;
	previewThrows?: Map<number, Error>;
	beforeSnapshot?: LibrarySnapshot;
	afterSnapshot?: LibrarySnapshot;
}

function createMockAdapter(opts: MockAdapterOptions = {}): RenameAdapter & {
	_folderRenameCalls: { ids: number[]; rootFolderPath: string }[];
} {
	const folderRenameCalls: { ids: number[]; rootFolderPath: string }[] = [];
	let snapshotCallCount = 0;

	return {
		getLibraryItems: () => Promise.resolve(opts.items ?? []),
		getTags: () => Promise.resolve(opts.tags ?? TAGS),
		getRenamePreview: (id: number) => {
			if (opts.previewThrows?.has(id)) {
				return Promise.reject(opts.previewThrows.get(id));
			}
			return Promise.resolve(opts.previews?.get(id) ?? []);
		},
		renameFiles: (_ids: number[]) => {
			if (opts.renameThrows) return Promise.reject(opts.renameThrows);
			return Promise.resolve(
				opts.renameResult ?? { id: 1, name: 'Rename', commandName: 'Rename', status: 'queued' }
			);
		},
		renameFolders: (ids: number[], rootFolderPath: string) => {
			folderRenameCalls.push({ ids, rootFolderPath });
			if (opts.folderRenameThrows) return Promise.reject(opts.folderRenameThrows);
			return Promise.resolve();
		},
		waitForCommand: (_id: number) => {
			return Promise.resolve(opts.waitResult ?? opts.renameResult ?? NOOP_COMMAND_RESULT);
		},
		getSnapshot: (_entityIds: number[]) => {
			snapshotCallCount++;
			if (snapshotCallCount === 1) {
				return Promise.resolve(opts.beforeSnapshot ?? new Map());
			}
			return Promise.resolve(opts.afterSnapshot ?? new Map());
		},
		_folderRenameCalls: folderRenameCalls
	};
}

// =========================================================================
// Tests
// =========================================================================

class RenameProcessorTest extends BaseTest {
	// ---------------------------------------------------------------------------
	// parseRenamedCount
	// ---------------------------------------------------------------------------

	testParseRenamedCount(): void {
		this.test('parseRenamedCount: extracts count from Radarr message', () => {
			assertEquals(parseRenamedCount('1 movie files renamed for 28 Years Later'), 1);
		});

		this.test('parseRenamedCount: extracts count from Sonarr message', () => {
			assertEquals(
				parseRenamedCount('6 episode files renamed for A Knight of the Seven Kingdoms'),
				6
			);
		});

		this.test('parseRenamedCount: returns 0 for no-op', () => {
			assertEquals(parseRenamedCount('0 movie files renamed'), 0);
		});

		this.test('parseRenamedCount: returns 0 for undefined', () => {
			assertEquals(parseRenamedCount(undefined), 0);
		});

		this.test('parseRenamedCount: returns 0 for non-numeric message', () => {
			assertEquals(parseRenamedCount('no numbers here'), 0);
		});
	}

	// ---------------------------------------------------------------------------
	// groupByRootFolder
	// ---------------------------------------------------------------------------

	testGroupByRootFolder(): void {
		this.test('groupByRootFolder: single root folder', () => {
			const items: LibraryItem[] = [RADARR_MOVIE, { ...TAGGED_MOVIE, tags: [] }];
			const groups = groupByRootFolder(items);

			assertEquals(groups.size, 1);
			assertEquals(groups.get('/data/media/movies')?.length, 2);
			assertEquals(groups.get('/data/media/movies')?.includes(1422), true);
			assertEquals(groups.get('/data/media/movies')?.includes(999), true);
		});

		this.test('groupByRootFolder: multiple root folders', () => {
			const items: LibraryItem[] = [RADARR_MOVIE, ALT_ROOT_MOVIE];
			const groups = groupByRootFolder(items);

			assertEquals(groups.size, 2);
			assertEquals(groups.get('/data/media/movies'), [1422]);
			assertEquals(groups.get('/data/media/movies-4k'), [500]);
		});

		this.test('groupByRootFolder: empty list', () => {
			const groups = groupByRootFolder([]);
			assertEquals(groups.size, 0);
		});
	}

	// ---------------------------------------------------------------------------
	// createLog
	// ---------------------------------------------------------------------------

	testCreateLog(): void {
		this.test('createLog: creates correct log structure', () => {
			const instance = makeInstance();
			const settings = makeSettings({ renameFolders: true, ignoreTag: 'profilarr-ignore' });
			const log = createLog(instance, settings, true, false);

			assertEquals(log.instanceId, 1);
			assertEquals(log.instanceName, 'Test Radarr');
			assertEquals(log.instanceType, 'radarr');
			assertEquals(log.status, 'success');
			assertEquals(log.config.dryRun, false);
			assertEquals(log.config.renameFolders, true);
			assertEquals(log.config.ignoreTag, 'profilarr-ignore');
			assertEquals(log.config.manual, true);
			assertEquals(log.results.filesRenamed, 0);
			assertEquals(log.results.errors.length, 0);
			assertEquals(log.renamedItems.length, 0);
			assertEquals(typeof log.id, 'string');
			assertEquals(log.id.length > 0, true);
		});
	}

	// ---------------------------------------------------------------------------
	// Dry run — Radarr
	// ---------------------------------------------------------------------------

	testDryRunRadarr(): void {
		this.test('dry run: Radarr movie with 1 file needing rename', async () => {
			const previews = new Map<number, RenamePreviewItem[]>();
			previews.set(1422, RADARR_PREVIEW);

			const adapter = createMockAdapter({ previews });
			const log = createLog(makeInstance(), makeSettings(), false, true);

			await processDryRun(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.filesNeedingRename, 1);
			assertEquals(log.results.filesRenamed, 0);
			assertEquals(log.renamedItems.length, 1);
			assertEquals(log.renamedItems[0].id, 1422);
			assertEquals(log.renamedItems[0].title, '28 Years Later');
			assertEquals(log.renamedItems[0].files.length, 1);
			assertEquals(
				log.renamedItems[0].files[0].existingPath,
				'28 Years Later (2025)/28 Years Later (2025).mkv'
			);
		});

		this.test('dry run: Radarr movie with no files needing rename', async () => {
			const adapter = createMockAdapter({}); // No previews = nothing to rename
			const log = createLog(makeInstance(), makeSettings(), false, true);

			await processDryRun(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.filesNeedingRename, 0);
			assertEquals(log.renamedItems.length, 0);
		});
	}

	// ---------------------------------------------------------------------------
	// Dry run — Sonarr
	// ---------------------------------------------------------------------------

	testDryRunSonarr(): void {
		this.test('dry run: Sonarr series with 6 episodes needing rename', async () => {
			const previews = new Map<number, RenamePreviewItem[]>();
			previews.set(77, SONARR_PREVIEW);

			const adapter = createMockAdapter({ previews });
			const instance = makeInstance({ name: 'Test Sonarr', type: 'sonarr' });
			const log = createLog(instance, makeSettings(), false, true);

			await processDryRun(adapter, [SONARR_SERIES], log);

			assertEquals(log.results.filesNeedingRename, 6);
			assertEquals(log.renamedItems.length, 1);
			assertEquals(log.renamedItems[0].id, 77);
			assertEquals(log.renamedItems[0].title, 'A Knight of the Seven Kingdoms');
			assertEquals(log.renamedItems[0].files.length, 6);
		});
	}

	// ---------------------------------------------------------------------------
	// Dry run — preview error
	// ---------------------------------------------------------------------------

	testDryRunPreviewError(): void {
		this.test('dry run: preview error for one item, other items still processed', async () => {
			const previews = new Map<number, RenamePreviewItem[]>();
			previews.set(1422, RADARR_PREVIEW);

			const previewThrows = new Map<number, Error>();
			previewThrows.set(500, new Error('Connection refused'));

			const adapter = createMockAdapter({ previews, previewThrows });
			const log = createLog(makeInstance(), makeSettings(), false, true);

			await processDryRun(adapter, [RADARR_MOVIE, ALT_ROOT_MOVIE], log);

			assertEquals(log.results.filesNeedingRename, 1);
			assertEquals(log.renamedItems.length, 1);
			assertEquals(log.results.errors.length, 1);
			assertEquals(log.results.errors[0].includes('Alt Root Movie'), true);
			assertEquals(log.results.errors[0].includes('Connection refused'), true);
		});
	}

	// ---------------------------------------------------------------------------
	// Dry run — empty items list
	// ---------------------------------------------------------------------------

	testDryRunEmpty(): void {
		this.test('dry run: empty items list produces zero counts', async () => {
			const adapter = createMockAdapter();
			const log = createLog(makeInstance(), makeSettings(), false, true);

			await processDryRun(adapter, [], log);

			assertEquals(log.results.filesNeedingRename, 0);
			assertEquals(log.renamedItems.length, 0);
			assertEquals(log.results.errors.length, 0);
		});
	}

	// ---------------------------------------------------------------------------
	// File rename — Radarr
	// ---------------------------------------------------------------------------

	testFileRenameRadarr(): void {
		this.test('file rename: Radarr renames 1 file', async () => {
			const adapter = createMockAdapter({
				renameResult: {
					id: 12345,
					name: 'RenameMovie',
					commandName: 'RenameMovie',
					status: 'queued'
				},
				waitResult: RADARR_COMMAND_RESULT
			});
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFileRename(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.filesRenamed, 1);
			assertEquals(log.results.commandsTriggered, 1);
			assertEquals(log.results.commandsCompleted, 1);
			assertEquals(log.results.commandsFailed, 0);
			assertEquals(log.results.errors.length, 0);
		});
	}

	// ---------------------------------------------------------------------------
	// File rename — Sonarr
	// ---------------------------------------------------------------------------

	testFileRenameSonarr(): void {
		this.test('file rename: Sonarr renames 6 episode files', async () => {
			const adapter = createMockAdapter({
				renameResult: {
					id: 67890,
					name: 'RenameSeries',
					commandName: 'RenameSeries',
					status: 'queued'
				},
				waitResult: SONARR_COMMAND_RESULT
			});
			const instance = makeInstance({ name: 'Test Sonarr', type: 'sonarr' });
			const log = createLog(instance, makeSettings(), false, false);

			await processFileRename(adapter, [SONARR_SERIES], log);

			assertEquals(log.results.filesRenamed, 6);
			assertEquals(log.results.commandsTriggered, 1);
			assertEquals(log.results.commandsCompleted, 1);
		});
	}

	// ---------------------------------------------------------------------------
	// File rename — no-op (already renamed)
	// ---------------------------------------------------------------------------

	testFileRenameNoop(): void {
		this.test('file rename: no-op when files already match naming', async () => {
			const adapter = createMockAdapter({
				renameResult: {
					id: 11111,
					name: 'RenameMovie',
					commandName: 'RenameMovie',
					status: 'queued'
				},
				waitResult: NOOP_COMMAND_RESULT
			});
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFileRename(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.filesRenamed, 0);
			assertEquals(log.results.commandsTriggered, 1);
			assertEquals(log.results.commandsCompleted, 1);
			assertEquals(log.results.errors.length, 0);
		});
	}

	// ---------------------------------------------------------------------------
	// File rename — error
	// ---------------------------------------------------------------------------

	testFileRenameError(): void {
		this.test('file rename: command fails', async () => {
			const adapter = createMockAdapter({
				renameThrows: new Error('API connection timeout')
			});
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFileRename(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.commandsFailed, 1);
			assertEquals(log.results.filesRenamed, 0);
			assertEquals(log.results.errors.length, 1);
			assertEquals(log.results.errors[0].includes('API connection timeout'), true);
		});
	}

	// ---------------------------------------------------------------------------
	// Folder rename — single root
	// ---------------------------------------------------------------------------

	testFolderRenameSingleRoot(): void {
		this.test('folder rename: single root folder', async () => {
			const adapter = createMockAdapter();
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFolderRename(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.commandsTriggered, 1);
			assertEquals(log.results.commandsCompleted, 1);
			assertEquals(adapter._folderRenameCalls.length, 1);
			assertEquals(adapter._folderRenameCalls[0].ids, [1422]);
			assertEquals(adapter._folderRenameCalls[0].rootFolderPath, '/data/media/movies');
		});
	}

	// ---------------------------------------------------------------------------
	// Folder rename — multiple roots
	// ---------------------------------------------------------------------------

	testFolderRenameMultipleRoots(): void {
		this.test('folder rename: groups by root folder path', async () => {
			const adapter = createMockAdapter();
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFolderRename(adapter, [RADARR_MOVIE, ALT_ROOT_MOVIE], log);

			assertEquals(adapter._folderRenameCalls.length, 2);

			const movieCall = adapter._folderRenameCalls.find(
				(c) => c.rootFolderPath === '/data/media/movies'
			);
			const altCall = adapter._folderRenameCalls.find(
				(c) => c.rootFolderPath === '/data/media/movies-4k'
			);

			assertEquals(movieCall?.ids, [1422]);
			assertEquals(altCall?.ids, [500]);
			assertEquals(log.results.commandsTriggered, 2);
		});
	}

	// ---------------------------------------------------------------------------
	// Folder rename — error
	// ---------------------------------------------------------------------------

	testFolderRenameError(): void {
		this.test('folder rename: fails with error', async () => {
			const adapter = createMockAdapter({
				folderRenameThrows: new Error('Permission denied')
			});
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFolderRename(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.commandsFailed, 1);
			assertEquals(log.results.errors.length, 1);
			assertEquals(log.results.errors[0].includes('Permission denied'), true);
			assertEquals(log.results.errors[0].includes('/data/media/movies'), true);
		});
	}

	// ---------------------------------------------------------------------------
	// diffSnapshots
	// ---------------------------------------------------------------------------

	testDiffSnapshotsNoChanges(): void {
		this.test('diffSnapshots: no changes returns empty array', () => {
			const snapshot: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: [{ id: 1399, relativePath: '28 Years Later (2025).mkv' }]
					}
				]
			]);

			const diff = diffSnapshots(snapshot, snapshot);
			assertEquals(diff.length, 0);
		});
	}

	testDiffSnapshotsFileRename(): void {
		this.test('diffSnapshots: detects file rename', () => {
			const before: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: [{ id: 1399, relativePath: '28 Years Latera (2025).mkv' }]
					}
				]
			]);

			const after: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: [{ id: 1399, relativePath: '28 Years Later (2025).mkv' }]
					}
				]
			]);

			const diff = diffSnapshots(before, after);
			assertEquals(diff.length, 1);
			assertEquals(diff[0].id, 1422);
			assertEquals(diff[0].folder, undefined);
			assertEquals(diff[0].files.length, 1);
			assertEquals(diff[0].files[0].oldPath, '28 Years Latera (2025).mkv');
			assertEquals(diff[0].files[0].newPath, '28 Years Later (2025).mkv');
		});
	}

	testDiffSnapshotsFolderRename(): void {
		this.test('diffSnapshots: detects folder rename', () => {
			const before: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Latera (2025)',
						files: [{ id: 1399, relativePath: '28 Years Later (2025).mkv' }]
					}
				]
			]);

			const after: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: [{ id: 1399, relativePath: '28 Years Later (2025).mkv' }]
					}
				]
			]);

			const diff = diffSnapshots(before, after);
			assertEquals(diff.length, 1);
			assertEquals(diff[0].folder?.oldPath, '/data/media/movies/28 Years Latera (2025)');
			assertEquals(diff[0].folder?.newPath, '/data/media/movies/28 Years Later (2025)');
			assertEquals(diff[0].files.length, 0);
		});
	}

	testDiffSnapshotsBothFileAndFolder(): void {
		this.test('diffSnapshots: detects both file and folder rename', () => {
			const before: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Latera (2025)',
						files: [{ id: 1399, relativePath: '28 Years Latera (2025).mkv' }]
					}
				]
			]);

			const after: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: [{ id: 1399, relativePath: '28 Years Later (2025).mkv' }]
					}
				]
			]);

			const diff = diffSnapshots(before, after);
			assertEquals(diff.length, 1);
			assertEquals(diff[0].folder !== undefined, true);
			assertEquals(diff[0].files.length, 1);
		});
	}

	testDiffSnapshotsMixedChangedUnchanged(): void {
		this.test('diffSnapshots: ignores unchanged entities', () => {
			const before: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Latera (2025)',
						files: [{ id: 1399, relativePath: '28 Years Latera (2025).mkv' }]
					}
				],
				[
					500,
					{
						id: 500,
						title: 'Alt Root Movie',
						folderPath: '/data/media/movies-4k/Alt Root Movie (2024)',
						files: [{ id: 501, relativePath: 'Alt Root Movie (2024).mkv' }]
					}
				]
			]);

			const after: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: [{ id: 1399, relativePath: '28 Years Later (2025).mkv' }]
					}
				],
				[
					500,
					{
						id: 500,
						title: 'Alt Root Movie',
						folderPath: '/data/media/movies-4k/Alt Root Movie (2024)',
						files: [{ id: 501, relativePath: 'Alt Root Movie (2024).mkv' }]
					}
				]
			]);

			const diff = diffSnapshots(before, after);
			assertEquals(diff.length, 1);
			assertEquals(diff[0].id, 1422);
		});
	}

	testDiffSnapshotsEntityNoFiles(): void {
		this.test('diffSnapshots: handles entity with no files (folder only)', () => {
			const before: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Latera (2025)',
						files: []
					}
				]
			]);

			const after: LibrarySnapshot = new Map([
				[
					1422,
					{
						id: 1422,
						title: '28 Years Later',
						folderPath: '/data/media/movies/28 Years Later (2025)',
						files: []
					}
				]
			]);

			const diff = diffSnapshots(before, after);
			assertEquals(diff.length, 1);
			assertEquals(diff[0].folder !== undefined, true);
			assertEquals(diff[0].files.length, 0);
		});
	}

	testDiffSnapshotsSonarrMultipleFiles(): void {
		this.test('diffSnapshots: Sonarr series with 6 episode file renames', () => {
			const before: LibrarySnapshot = new Map([
				[
					77,
					{
						id: 77,
						title: 'A Knight of the Seven Kingdoms',
						folderPath: '/data/media/tv/A Knight of the Seven Kingdoms',
						files: [
							{ id: 1001, relativePath: 'Season 01/S01E01 - The Hedge Knight.mkv' },
							{ id: 1002, relativePath: 'Season 01/S01E02 - The Plea.mkv' },
							{ id: 1003, relativePath: 'Season 01/S01E03 - The Pupil.mkv' },
							{ id: 1004, relativePath: 'Season 01/S01E04 - The Trial.mkv' },
							{ id: 1005, relativePath: 'Season 01/S01E05 - The Tourney.mkv' },
							{ id: 1006, relativePath: 'Season 01/S01E06 - The Mystery Knight.mkv' }
						]
					}
				]
			]);

			const after: LibrarySnapshot = new Map([
				[
					77,
					{
						id: 77,
						title: 'A Knight of the Seven Kingdoms',
						folderPath: '/data/media/tv/A Knight of the Seven Kingdoms',
						files: [
							{ id: 1001, relativePath: 'Season 01a/S01E01 - The Hedge Knighta.mkv' },
							{ id: 1002, relativePath: 'Season 01a/S01E02 - The Pleaa.mkv' },
							{ id: 1003, relativePath: 'Season 01a/S01E03 - The Pupila.mkv' },
							{ id: 1004, relativePath: 'Season 01a/S01E04 - The Triala.mkv' },
							{ id: 1005, relativePath: 'Season 01a/S01E05 - The Tourneya.mkv' },
							{ id: 1006, relativePath: 'Season 01a/S01E06 - The Mystery Knighta.mkv' }
						]
					}
				]
			]);

			const diff = diffSnapshots(before, after);
			assertEquals(diff.length, 1);
			assertEquals(diff[0].id, 77);
			assertEquals(diff[0].files.length, 6);
			assertEquals(diff[0].folder, undefined);
		});
	}

	// ---------------------------------------------------------------------------
	// Combined — file + folder rename
	// ---------------------------------------------------------------------------

	testCombinedFileAndFolderRename(): void {
		this.test('combined: file rename then folder rename', async () => {
			const adapter = createMockAdapter({
				renameResult: {
					id: 12345,
					name: 'RenameMovie',
					commandName: 'RenameMovie',
					status: 'queued'
				},
				waitResult: RADARR_COMMAND_RESULT
			});
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFileRename(adapter, [RADARR_MOVIE, ALT_ROOT_MOVIE], log);
			await processFolderRename(adapter, [RADARR_MOVIE, ALT_ROOT_MOVIE], log);

			// File rename
			assertEquals(log.results.filesRenamed, 1);
			assertEquals(log.results.commandsCompleted, 3); // 1 file + 2 folder
			assertEquals(log.results.commandsTriggered, 3);
			assertEquals(log.results.errors.length, 0);
		});
	}

	// ---------------------------------------------------------------------------
	// Combined — file fails, folder still runs
	// ---------------------------------------------------------------------------

	testCombinedFileFailsFolderSucceeds(): void {
		this.test('combined: file rename fails, folder rename still succeeds', async () => {
			const adapter = createMockAdapter({
				renameThrows: new Error('API timeout')
			});
			const log = createLog(makeInstance(), makeSettings(), false, false);

			await processFileRename(adapter, [RADARR_MOVIE], log);
			await processFolderRename(adapter, [RADARR_MOVIE], log);

			assertEquals(log.results.filesRenamed, 0);
			assertEquals(log.results.commandsFailed, 1);
			assertEquals(log.results.commandsCompleted, 1);
			assertEquals(log.results.errors.length, 1);
		});
	}

	// ---------------------------------------------------------------------------
	// Run all tests
	// ---------------------------------------------------------------------------

	runTests(): void {
		this.testParseRenamedCount();
		this.testGroupByRootFolder();
		this.testCreateLog();
		this.testDryRunRadarr();
		this.testDryRunSonarr();
		this.testDryRunPreviewError();
		this.testDryRunEmpty();
		this.testFileRenameRadarr();
		this.testFileRenameSonarr();
		this.testFileRenameNoop();
		this.testFileRenameError();
		this.testFolderRenameSingleRoot();
		this.testFolderRenameMultipleRoots();
		this.testFolderRenameError();
		this.testDiffSnapshotsNoChanges();
		this.testDiffSnapshotsFileRename();
		this.testDiffSnapshotsFolderRename();
		this.testDiffSnapshotsBothFileAndFolder();
		this.testDiffSnapshotsMixedChangedUnchanged();
		this.testDiffSnapshotsEntityNoFiles();
		this.testDiffSnapshotsSonarrMultipleFiles();
		this.testCombinedFileAndFolderRename();
		this.testCombinedFileFailsFolderSucceeds();
	}
}

const test = new RenameProcessorTest();
await test.runTests();
