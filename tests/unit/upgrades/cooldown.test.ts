/**
 * Tests for cooldown logic
 * Tests the pure functions in upgrades/cooldown.ts
 * Also tests API-dependent functions with mocked RadarrClient
 */

import { BaseTest } from '../base/BaseTest.ts';
import { assertEquals } from '@std/assert';
import {
	getFilterTagLabel,
	isFilterTag,
	hasFilterTag,
	filterByFilterTag,
	isFilterExhausted,
	applyFilterTagToMovies,
	resetFilterCooldown,
	resolveTagLabel
} from '../../../src/lib/server/upgrades/cooldown.ts';
import type { ArrTag, RadarrMovie } from '../../../src/lib/server/utils/arr/types.ts';
import type { RadarrClient } from '../../../src/lib/server/utils/arr/clients/radarr.ts';

/**
 * Mock RadarrClient for testing
 * Stores state in-memory to simulate Radarr behavior
 */
class MockRadarrClient {
	tags: ArrTag[] = [];
	movies: RadarrMovie[] = [];
	private nextTagId = 1;

	constructor(initialMovies: Partial<RadarrMovie>[] = []) {
		this.movies = initialMovies.map(
			(m, i) =>
				({
					id: m.id ?? i + 1,
					title: m.title ?? `Movie ${i + 1}`,
					tags: m.tags ?? [],
					// Required fields with defaults
					tmdbId: m.tmdbId ?? 0,
					year: m.year ?? 2024,
					qualityProfileId: m.qualityProfileId ?? 1,
					monitored: m.monitored ?? true,
					hasFile: m.hasFile ?? true,
					added: m.added ?? new Date().toISOString(),
					minimumAvailability: m.minimumAvailability ?? 'released',
					status: m.status ?? 'released',
					sizeOnDisk: m.sizeOnDisk ?? 0,
					runtime: m.runtime ?? 120,
					popularity: m.popularity ?? 0,
					movieFileId: m.movieFileId ?? 0,
					path: m.path ?? '/movies',
					rootFolderPath: m.rootFolderPath ?? '/movies'
				}) as RadarrMovie
		);
	}

	async getTags(): Promise<ArrTag[]> {
		return this.tags;
	}

	async getMovies(): Promise<RadarrMovie[]> {
		return this.movies;
	}

	async getOrCreateTag(label: string): Promise<ArrTag> {
		const existing = this.tags.find((t) => t.label.toLowerCase() === label.toLowerCase());
		if (existing) return existing;

		const newTag: ArrTag = { id: this.nextTagId++, label };
		this.tags.push(newTag);
		return newTag;
	}

	async updateMovie(movie: RadarrMovie): Promise<RadarrMovie> {
		const index = this.movies.findIndex((m) => m.id === movie.id);
		if (index >= 0) {
			this.movies[index] = movie;
		}
		return movie;
	}
}

class CooldownTest extends BaseTest {
	runTests(): void {
		// =====================
		// getFilterTagLabel (slugify)
		// =====================

		this.test('getFilterTagLabel: simple name', () => {
			const label = getFilterTagLabel('My Filter');
			assertEquals(label, 'profilarr-my-filter');
		});

		this.test('getFilterTagLabel: name with apostrophe', () => {
			const label = getFilterTagLabel("Things I Don't Want");
			assertEquals(label, 'profilarr-things-i-dont-want');
		});

		this.test('getFilterTagLabel: name with special characters', () => {
			const label = getFilterTagLabel('4K HDR (Dolby Vision)');
			assertEquals(label, 'profilarr-4k-hdr-dolby-vision');
		});

		this.test('getFilterTagLabel: name with multiple spaces', () => {
			const label = getFilterTagLabel('Filter   With   Spaces');
			assertEquals(label, 'profilarr-filter-with-spaces');
		});

		this.test('getFilterTagLabel: already lowercase', () => {
			const label = getFilterTagLabel('already-lowercase');
			assertEquals(label, 'profilarr-already-lowercase');
		});

		this.test('getFilterTagLabel: numbers preserved', () => {
			const label = getFilterTagLabel('Filter 123');
			assertEquals(label, 'profilarr-filter-123');
		});

		this.test('getFilterTagLabel: long name truncated to 50 chars', () => {
			const longName =
				'This is a very long filter name that should be truncated to fifty characters';
			const label = getFilterTagLabel(longName);
			// profilarr- prefix (10 chars) + 50 char max slug = 60 max
			assertEquals(label.length <= 60, true);
			assertEquals(label.startsWith('profilarr-'), true);
			assertEquals(label, 'profilarr-this-is-a-very-long-filter-name-that-should-be-tru');
		});

		// =====================
		// resolveTagLabel
		// =====================

		this.test('resolveTagLabel: uses custom tag when set', () => {
			const label = resolveTagLabel({ name: 'My Filter', tag: 'my-custom-tag' });
			assertEquals(label, 'my-custom-tag');
		});

		this.test('resolveTagLabel: falls back to auto-generated when tag is empty', () => {
			const label = resolveTagLabel({ name: 'My Filter', tag: '' });
			assertEquals(label, 'profilarr-my-filter');
		});

		this.test('resolveTagLabel: falls back to auto-generated when tag is undefined', () => {
			const label = resolveTagLabel({ name: 'My Filter' });
			assertEquals(label, 'profilarr-my-filter');
		});

		this.test('resolveTagLabel: trims whitespace from custom tag', () => {
			const label = resolveTagLabel({ name: 'My Filter', tag: '  my-tag  ' });
			assertEquals(label, 'my-tag');
		});

		this.test('resolveTagLabel: whitespace-only tag falls back to auto-generated', () => {
			const label = resolveTagLabel({ name: 'My Filter', tag: '   ' });
			assertEquals(label, 'profilarr-my-filter');
		});

		// =====================
		// isFilterTag
		// =====================

		this.test('isFilterTag: matches profilarr tag', () => {
			assertEquals(isFilterTag('profilarr-my-filter'), true);
		});

		this.test('isFilterTag: rejects non-profilarr tag', () => {
			assertEquals(isFilterTag('some-other-tag'), false);
		});

		this.test('isFilterTag: rejects empty string', () => {
			assertEquals(isFilterTag(''), false);
		});

		// =====================
		// hasFilterTag
		// =====================

		this.test('hasFilterTag: finds matching tag', () => {
			const allTags: ArrTag[] = [
				{ id: 1, label: 'profilarr-my-filter' },
				{ id: 2, label: 'other-tag' }
			];
			const itemTagIds = [1, 2];
			assertEquals(hasFilterTag(itemTagIds, allTags, getFilterTagLabel('My Filter')), true);
		});

		this.test('hasFilterTag: returns false when tag not present', () => {
			const allTags: ArrTag[] = [
				{ id: 1, label: 'profilarr-other-filter' },
				{ id: 2, label: 'other-tag' }
			];
			const itemTagIds = [1, 2];
			assertEquals(hasFilterTag(itemTagIds, allTags, getFilterTagLabel('My Filter')), false);
		});

		this.test('hasFilterTag: returns false when item has no tags', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const itemTagIds: number[] = [];
			assertEquals(hasFilterTag(itemTagIds, allTags, getFilterTagLabel('My Filter')), false);
		});

		this.test('hasFilterTag: handles case-insensitive filter name', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const itemTagIds = [1];
			// getFilterTagLabel lowercases, so "MY FILTER" -> "profilarr-my-filter"
			assertEquals(hasFilterTag(itemTagIds, allTags, getFilterTagLabel('MY FILTER')), true);
		});

		// =====================
		// filterByFilterTag
		// =====================

		this.test('filterByFilterTag: filters out tagged items', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const items = [
				{ id: 1, title: 'Tagged Movie', _tags: [1] },
				{ id: 2, title: 'Untagged Movie', _tags: [] },
				{ id: 3, title: 'Other Tagged', _tags: [2] }
			];

			const result = filterByFilterTag(items, allTags, getFilterTagLabel('My Filter'));
			assertEquals(result.length, 2);
			assertEquals(result[0].title, 'Untagged Movie');
			assertEquals(result[1].title, 'Other Tagged');
		});

		this.test('filterByFilterTag: returns all items when none tagged', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-other-filter' }];
			const items = [
				{ id: 1, title: 'Movie 1', _tags: [] },
				{ id: 2, title: 'Movie 2', _tags: [1] }
			];

			const result = filterByFilterTag(items, allTags, getFilterTagLabel('My Filter'));
			assertEquals(result.length, 2);
		});

		this.test('filterByFilterTag: returns empty when all tagged', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const items = [
				{ id: 1, title: 'Movie 1', _tags: [1] },
				{ id: 2, title: 'Movie 2', _tags: [1] }
			];

			const result = filterByFilterTag(items, allTags, getFilterTagLabel('My Filter'));
			assertEquals(result.length, 0);
		});

		// =====================
		// isFilterExhausted
		// =====================

		this.test('isFilterExhausted: true when all items tagged', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const items = [
				{ id: 1, _tags: [1] },
				{ id: 2, _tags: [1] }
			];

			assertEquals(isFilterExhausted(items, allTags, getFilterTagLabel('My Filter')), true);
		});

		this.test('isFilterExhausted: false when some items untagged', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const items = [
				{ id: 1, _tags: [1] },
				{ id: 2, _tags: [] }
			];

			assertEquals(isFilterExhausted(items, allTags, getFilterTagLabel('My Filter')), false);
		});

		this.test('isFilterExhausted: false when no items matched', () => {
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-my-filter' }];
			const items: { id: number; _tags: number[] }[] = [];

			assertEquals(isFilterExhausted(items, allTags, getFilterTagLabel('My Filter')), false);
		});

		this.test('isFilterExhausted: true triggers reset cycle', () => {
			// Simulates: matched 3 items, all 3 tagged = exhausted = reset
			const allTags: ArrTag[] = [{ id: 1, label: 'profilarr-upgrade-filter' }];
			const matchedItems = [
				{ id: 100, _tags: [1] },
				{ id: 200, _tags: [1] },
				{ id: 300, _tags: [1] }
			];

			const exhausted = isFilterExhausted(
				matchedItems,
				allTags,
				getFilterTagLabel('Upgrade Filter')
			);
			assertEquals(exhausted, true);
			// When exhausted, processor should call resetFilterCooldown()
		});

		// =====================
		// Full Cycle Scenarios
		// =====================

		this.test('scenario: complete tag-exhaust-reset cycle', () => {
			const filterName = 'My Upgrade Filter';
			const tagLabel = getFilterTagLabel(filterName);
			const tagId = 42;

			// Step 1: Initial state - no tags exist, 3 matched items
			let allTags: ArrTag[] = [];
			let items = [
				{ id: 1, title: 'Movie A', _tags: [] as number[] },
				{ id: 2, title: 'Movie B', _tags: [] as number[] },
				{ id: 3, title: 'Movie C', _tags: [] as number[] }
			];

			// All items available (none tagged)
			let available = filterByFilterTag(items, allTags, tagLabel);
			assertEquals(available.length, 3, 'All 3 items should be available initially');
			assertEquals(isFilterExhausted(items, allTags, tagLabel), false);

			// Step 2: First run - tag is created, 1 item searched and tagged
			allTags = [{ id: tagId, label: tagLabel }];
			items[0]._tags = [tagId]; // Movie A tagged

			available = filterByFilterTag(items, allTags, tagLabel);
			assertEquals(available.length, 2, '2 items should be available after first search');
			assertEquals(isFilterExhausted(items, allTags, tagLabel), false);

			// Step 3: Second run - another item tagged
			items[1]._tags = [tagId]; // Movie B tagged

			available = filterByFilterTag(items, allTags, tagLabel);
			assertEquals(available.length, 1, '1 item should be available');
			assertEquals(isFilterExhausted(items, allTags, tagLabel), false);

			// Step 4: Third run - last item tagged, filter exhausted
			items[2]._tags = [tagId]; // Movie C tagged

			available = filterByFilterTag(items, allTags, tagLabel);
			assertEquals(available.length, 0, 'No items should be available');
			assertEquals(isFilterExhausted(items, allTags, tagLabel), true, 'Filter should be exhausted');

			// Step 5: Reset - tags removed (simulates resetFilterCooldown)
			items[0]._tags = [];
			items[1]._tags = [];
			items[2]._tags = [];

			available = filterByFilterTag(items, allTags, tagLabel);
			assertEquals(available.length, 3, 'All 3 items should be available after reset');
			assertEquals(
				isFilterExhausted(items, allTags, tagLabel),
				false,
				'Filter should not be exhausted after reset'
			);
		});

		this.test('scenario: multiple filters operate independently', () => {
			const tag1Label = getFilterTagLabel('Filter One');
			const tag2Label = getFilterTagLabel('Filter Two');
			const tag1Id = 1;
			const tag2Id = 2;

			const allTags: ArrTag[] = [
				{ id: tag1Id, label: tag1Label },
				{ id: tag2Id, label: tag2Label }
			];

			const items = [
				{ id: 1, title: 'Movie A', _tags: [tag1Id] }, // Tagged by Filter One only
				{ id: 2, title: 'Movie B', _tags: [tag2Id] }, // Tagged by Filter Two only
				{ id: 3, title: 'Movie C', _tags: [tag1Id, tag2Id] }, // Tagged by both
				{ id: 4, title: 'Movie D', _tags: [] } // Not tagged
			];

			// Filter One sees: Movie B (not tagged by it), Movie D (not tagged)
			const availableForFilter1 = filterByFilterTag(items, allTags, tag1Label);
			assertEquals(availableForFilter1.length, 2);
			assertEquals(availableForFilter1[0].title, 'Movie B');
			assertEquals(availableForFilter1[1].title, 'Movie D');

			// Filter Two sees: Movie A (not tagged by it), Movie D (not tagged)
			const availableForFilter2 = filterByFilterTag(items, allTags, tag2Label);
			assertEquals(availableForFilter2.length, 2);
			assertEquals(availableForFilter2[0].title, 'Movie A');
			assertEquals(availableForFilter2[1].title, 'Movie D');

			// Neither filter is exhausted
			assertEquals(isFilterExhausted(items, allTags, tag1Label), false);
			assertEquals(isFilterExhausted(items, allTags, tag2Label), false);
		});

		this.test('scenario: new item added mid-cycle is picked up', () => {
			const tagLabel = getFilterTagLabel('Ongoing Filter');
			const tagId = 1;
			const allTags: ArrTag[] = [{ id: tagId, label: tagLabel }];

			// Start with 2 items, both tagged (exhausted)
			let items = [
				{ id: 1, title: 'Old Movie 1', _tags: [tagId] },
				{ id: 2, title: 'Old Movie 2', _tags: [tagId] }
			];

			assertEquals(isFilterExhausted(items, allTags, tagLabel), true, 'Should be exhausted');
			assertEquals(filterByFilterTag(items, allTags, tagLabel).length, 0);

			// User adds a new movie (no tag)
			items = [...items, { id: 3, title: 'New Movie', _tags: [] }];

			// Now filter is NOT exhausted - new item available
			assertEquals(
				isFilterExhausted(items, allTags, tagLabel),
				false,
				'Should not be exhausted after new item'
			);
			const available = filterByFilterTag(items, allTags, tagLabel);
			assertEquals(available.length, 1);
			assertEquals(available[0].title, 'New Movie');
		});

		// =====================
		// API-Dependent Functions (with Mock)
		// =====================

		this.test('applyFilterTagToMovies: tags multiple movies', async () => {
			const client = new MockRadarrClient([
				{ id: 1, title: 'Movie A', tags: [] },
				{ id: 2, title: 'Movie B', tags: [] },
				{ id: 3, title: 'Movie C', tags: [99] } // Already has another tag
			]);

			const filterTag = await client.getOrCreateTag('profilarr-test-filter');
			const movies = await client.getMovies();

			const result = await applyFilterTagToMovies(
				client as unknown as RadarrClient,
				movies,
				filterTag.id
			);

			assertEquals(result.success, 3);
			assertEquals(result.failed, 0);
			assertEquals(result.errors.length, 0);

			// Verify tags were applied
			const updatedMovies = await client.getMovies();
			assertEquals(updatedMovies[0].tags?.includes(filterTag.id), true);
			assertEquals(updatedMovies[1].tags?.includes(filterTag.id), true);
			assertEquals(updatedMovies[2].tags?.includes(filterTag.id), true);
			assertEquals(updatedMovies[2].tags?.includes(99), true); // Original tag preserved
		});

		this.test('applyFilterTagToMovies: skips already-tagged movies', async () => {
			const client = new MockRadarrClient([
				{ id: 1, title: 'Movie A', tags: [1] }, // Already has the filter tag
				{ id: 2, title: 'Movie B', tags: [] }
			]);
			client.tags = [{ id: 1, label: 'profilarr-test-filter' }];

			const movies = await client.getMovies();

			const result = await applyFilterTagToMovies(
				client as unknown as RadarrClient,
				movies,
				1 // tag id
			);

			// Both succeed (one skipped, one added)
			assertEquals(result.success, 2);
			assertEquals(result.failed, 0);
		});

		this.test('resetFilterCooldown: removes tags from all tagged movies', async () => {
			const tagLabel = getFilterTagLabel('Reset Test Filter');

			const client = new MockRadarrClient([
				{ id: 1, title: 'Tagged 1', tags: [1] },
				{ id: 2, title: 'Tagged 2', tags: [1] },
				{ id: 3, title: 'Not Tagged', tags: [] },
				{ id: 4, title: 'Other Tag', tags: [2] }
			]);
			client.tags = [
				{ id: 1, label: tagLabel },
				{ id: 2, label: 'other-tag' }
			];

			const result = await resetFilterCooldown(client as unknown as RadarrClient, tagLabel);

			assertEquals(result.reset, 2, 'Should reset 2 movies');
			assertEquals(result.failed, 0);
			assertEquals(result.errors.length, 0);

			// Verify tags were removed
			const movies = await client.getMovies();
			assertEquals(movies[0].tags?.includes(1), false, 'Tag should be removed from movie 1');
			assertEquals(movies[1].tags?.includes(1), false, 'Tag should be removed from movie 2');
			assertEquals((movies[2].tags ?? []).length, 0, 'Movie 3 should still have no tags');
			assertEquals(movies[3].tags?.includes(2), true, 'Movie 4 should keep other tag');
		});

		this.test('resetFilterCooldown: handles no tag existing', async () => {
			const client = new MockRadarrClient([{ id: 1, title: 'Movie A', tags: [] }]);
			// No tags exist

			const result = await resetFilterCooldown(
				client as unknown as RadarrClient,
				getFilterTagLabel('Non Existent Filter')
			);

			assertEquals(result.reset, 0);
			assertEquals(result.failed, 0);
			assertEquals(result.errors.length, 0);
		});

		this.test('resetFilterCooldown: handles no movies tagged', async () => {
			const tagLabel = getFilterTagLabel('Empty Filter');

			const client = new MockRadarrClient([
				{ id: 1, title: 'Movie A', tags: [] },
				{ id: 2, title: 'Movie B', tags: [2] } // Different tag
			]);
			client.tags = [
				{ id: 1, label: tagLabel },
				{ id: 2, label: 'other-tag' }
			];

			const result = await resetFilterCooldown(client as unknown as RadarrClient, tagLabel);

			assertEquals(result.reset, 0);
			assertEquals(result.failed, 0);
		});

		this.test('integration: full cycle with mock client', async () => {
			const tagLabel = getFilterTagLabel('Integration Test');

			// Setup: 3 movies, no tags
			const client = new MockRadarrClient([
				{ id: 1, title: 'Movie A', tags: [] },
				{ id: 2, title: 'Movie B', tags: [] },
				{ id: 3, title: 'Movie C', tags: [] }
			]);

			// Step 1: Create filter tag
			const filterTag = await client.getOrCreateTag(tagLabel);
			assertEquals(filterTag.label, tagLabel);

			// Step 2: Tag first 2 movies (simulating search)
			const movies = await client.getMovies();
			await applyFilterTagToMovies(
				client as unknown as RadarrClient,
				[movies[0], movies[1]],
				filterTag.id
			);

			// Step 3: Check state - 1 movie available
			let tags = await client.getTags();
			let currentMovies = await client.getMovies();
			let items = currentMovies.map((m) => ({ ...m, _tags: m.tags ?? [] }));

			let available = filterByFilterTag(items, tags, tagLabel);
			assertEquals(available.length, 1, 'Should have 1 available');
			assertEquals(available[0].title, 'Movie C');
			assertEquals(isFilterExhausted(items, tags, tagLabel), false);

			// Step 4: Tag last movie
			await applyFilterTagToMovies(client as unknown as RadarrClient, [movies[2]], filterTag.id);

			// Step 5: Now exhausted
			currentMovies = await client.getMovies();
			items = currentMovies.map((m) => ({ ...m, _tags: m.tags ?? [] }));

			assertEquals(isFilterExhausted(items, tags, tagLabel), true, 'Should be exhausted');
			assertEquals(filterByFilterTag(items, tags, tagLabel).length, 0);

			// Step 6: Reset
			const resetResult = await resetFilterCooldown(client as unknown as RadarrClient, tagLabel);
			assertEquals(resetResult.reset, 3, 'Should reset 3 movies');

			// Step 7: All available again
			currentMovies = await client.getMovies();
			items = currentMovies.map((m) => ({ ...m, _tags: m.tags ?? [] }));
			tags = await client.getTags();

			available = filterByFilterTag(items, tags, tagLabel);
			assertEquals(available.length, 3, 'All 3 should be available after reset');
			assertEquals(isFilterExhausted(items, tags, tagLabel), false);
		});
	}
}

// Create instance and run tests
const cooldownTest = new CooldownTest();
cooldownTest.runTests();
