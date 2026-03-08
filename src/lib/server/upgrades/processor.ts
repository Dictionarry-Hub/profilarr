/**
 * Main orchestrator for processing upgrade configs
 * Coordinates fetching, filtering, selection, and searching
 */

import { RadarrClient } from '$lib/server/utils/arr/clients/radarr.ts';
import { SonarrClient } from '$lib/server/utils/arr/clients/sonarr.ts';
import type { ArrInstance } from '$lib/server/db/queries/arrInstances.ts';
import type { UpgradeConfig, FilterConfig } from '$shared/upgrades/filters.ts';
import { evaluateGroup } from '$shared/upgrades/filters.ts';
import { getSelector } from '$shared/upgrades/selectors.ts';
import type {
	UpgradeItem,
	UpgradeJobLog,
	UpgradeSelectionItem,
	UpgradeOriginal,
	UpgradeOriginalEpisode
} from './types.ts';
import type {
	RadarrMovie,
	RadarrMovieFile,
	SonarrSeries,
	ArrTag
} from '$lib/server/utils/arr/types.ts';
import { normalizeRadarrItems, normalizeSonarrItems } from './normalize.ts';
import {
	filterByFilterTag,
	resolveTagLabel,
	applyFilterTagToMovies,
	applyFilterTagToSeries,
	isFilterExhausted,
	resetFilterCooldown
} from './cooldown.ts';
import { logUpgradeRun, logUpgradeError, logUpgradeSkipped } from './logger.ts';
import { notifications } from '$lib/server/notifications/definitions/index.ts';
import { notificationServicesQueries } from '$lib/server/db/queries/notificationServices.ts';

/**
 * In-memory cache for dry run exclusions
 * Tracks items "searched" in dry run mode to avoid selecting the same items repeatedly
 * Map<instanceId, { items: Set<itemId>, timestamp: number }>
 */
const dryRunExclusions = new Map<number, { items: Set<number>; timestamp: number }>();
const DRY_RUN_EXCLUSION_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Get excluded item IDs for dry run, auto-clearing stale entries
 */
function getDryRunExclusions(instanceId: number): Set<number> {
	const entry = dryRunExclusions.get(instanceId);
	if (!entry) return new Set();

	// Clear if expired
	if (Date.now() - entry.timestamp > DRY_RUN_EXCLUSION_TTL_MS) {
		dryRunExclusions.delete(instanceId);
		return new Set();
	}

	return entry.items;
}

/**
 * Add items to dry run exclusion cache
 */
function addDryRunExclusions(instanceId: number, itemIds: number[]): void {
	const existing = getDryRunExclusions(instanceId);
	for (const id of itemIds) {
		existing.add(id);
	}
	dryRunExclusions.set(instanceId, { items: existing, timestamp: Date.now() });
}

/**
 * Clear dry run exclusions for an instance
 * @returns Array of item IDs that were cleared
 */
export function clearDryRunExclusions(instanceId: number): number[] {
	const entry = dryRunExclusions.get(instanceId);
	const clearedIds = entry ? Array.from(entry.items) : [];
	dryRunExclusions.delete(instanceId);
	return clearedIds;
}

/**
 * Poll a queue function until results stabilize (no new items between polls)
 * Waits intervalMs between attempts, up to maxAttempts
 */
async function pollQueue<T>(
	fetch: () => Promise<T[]>,
	maxAttempts = 5,
	intervalMs = 3000
): Promise<T[]> {
	let lastCount = 0;
	let stableResult: T[] = [];

	for (let i = 0; i < maxAttempts; i++) {
		await new Promise((r) => setTimeout(r, intervalMs));
		const result = await fetch();

		if (result.length > 0 && result.length === lastCount) {
			// Queue stabilized — same count as last poll
			return result;
		}

		stableResult = result;
		lastCount = result.length;
	}

	return stableResult;
}

/**
 * Send upgrade notification
 */
async function sendUpgradeNotification(log: UpgradeJobLog, manual: boolean): Promise<void> {
	// Only notify if there were items searched
	if (log.selection.actualCount > 0) {
		const { DiscordNotifier } = await import(
			'$lib/server/notifications/notifiers/discord/index.ts'
		);

		// Get all enabled services that have this notification type enabled
		const services = notificationServicesQueries.getAllEnabled();
		const notificationType = `upgrade.${log.status}`;

		for (const service of services) {
			try {
				const enabledTypes = JSON.parse(service.enabled_types) as string[];
				if (!enabledTypes.includes(notificationType)) {
					continue;
				}

				const config = JSON.parse(service.config);

				if (service.service_type === 'discord') {
					const notifier = new DiscordNotifier(config);
					const notification = notifications.upgrade({ log, config, manual }).build();
					await notifier.notify(notification);
				}
			} catch {
				// Errors are logged by the notifier
			}
		}
	}
}

/**
 * Get the next filter to run based on the config's mode
 */
function getNextFilter(config: UpgradeConfig): FilterConfig | null {
	const enabledFilters = config.filters.filter((f) => f.enabled);

	if (enabledFilters.length === 0) {
		return null;
	}

	if (config.filterMode === 'random') {
		const randomIndex = Math.floor(Math.random() * enabledFilters.length);
		return enabledFilters[randomIndex];
	}

	// Round robin
	const index = config.currentFilterIndex % enabledFilters.length;
	return enabledFilters[index];
}

/**
 * Create an empty/skipped job log
 */
function createSkippedLog(
	config: UpgradeConfig,
	instance: ArrInstance,
	reason: string,
	dryRun: boolean = false
): UpgradeJobLog {
	const now = new Date().toISOString();
	return {
		id: crypto.randomUUID(),
		configId: config.id ?? 0,
		instanceId: instance.id,
		instanceName: instance.name,
		startedAt: now,
		completedAt: now,
		status: 'skipped',
		config: {
			cron: config.cron,
			filterMode: config.filterMode,
			selectedFilter: '',
			dryRun
		},
		library: {
			totalItems: 0,
			fetchedFromCache: false,
			fetchDurationMs: 0
		},
		filter: {
			id: '',
			name: '',
			rules: { type: 'group', match: 'all', children: [] },
			matchedCount: 0,
			afterCooldown: 0,
			dryRunExcluded: 0
		},
		selection: {
			method: '',
			requestedCount: 0,
			actualCount: 0,
			items: [] as UpgradeSelectionItem[]
		},
		results: {
			searchesTriggered: 0,
			successful: 0,
			failed: 0,
			errors: [reason]
		}
	};
}

/**
 * Pick the best season to search for a Sonarr series (for dry-run interactive search)
 * Picks the latest monitored season that has episode files
 */
function pickSeasonForSearch(series: SonarrSeries): number {
	const monitored = series.seasons
		.filter((s) => s.monitored && s.statistics.episodeFileCount > 0)
		.sort((a, b) => b.seasonNumber - a.seasonNumber);

	return monitored[0]?.seasonNumber ?? 1;
}

/**
 * Process a single upgrade config for an arr instance
 */
export async function processUpgradeConfig(
	config: UpgradeConfig,
	instance: ArrInstance,
	manual: boolean = false,
	dryRun: boolean = false
): Promise<UpgradeJobLog> {
	const startedAt = new Date();
	const logId = crypto.randomUUID();

	// Get the filter to run
	const filter = getNextFilter(config);

	if (!filter) {
		const log = createSkippedLog(config, instance, 'No enabled filters', dryRun);
		await logUpgradeSkipped(instance.id, instance.name, 'No enabled filters');
		return log;
	}

	// Create client based on instance type
	const isRadarr = instance.type === 'radarr';
	const clientOpts = { timeout: 120000 };
	const client = isRadarr
		? new RadarrClient(instance.url, instance.api_key, clientOpts)
		: new SonarrClient(instance.url, instance.api_key, clientOpts);

	try {
		// =====================================================================
		// Step 1: Fetch library data + normalize (app-specific)
		// =====================================================================
		const fetchStart = Date.now();
		let normalizedItems: UpgradeItem[];
		let totalItems: number;
		let tags: ArrTag[];
		let getOriginalFile: (item: UpgradeItem) => UpgradeOriginal;

		// Radarr-only: movie file map for original file lookup
		let movieFileMap: Map<number, RadarrMovieFile> | undefined;
		// Sonarr-only: episode file names cache (populated after selection)
		const episodeFileCache = new Map<number, UpgradeOriginalEpisode[]>();

		if (isRadarr) {
			const radarr = client as RadarrClient;
			const [movies, profiles] = await Promise.all([
				radarr.getMovies(),
				radarr.getQualityProfiles()
			]);

			const movieIdsWithFiles = movies.filter((m) => m.hasFile).map((m) => m.id);
			const movieFiles = await radarr.getMovieFiles(movieIdsWithFiles);

			movieFileMap = new Map(movieFiles.map((mf) => [mf.movieId, mf]));
			const profileMap = new Map(profiles.map((p) => [p.id, p]));

			tags = await radarr.getTags();
			const tagMap = new Map(tags.map((t) => [t.id, t.label]));

			normalizedItems = normalizeRadarrItems(
				movies,
				movieFileMap,
				profileMap,
				filter.cutoff,
				tagMap
			);
			totalItems = movies.length;

			const mfMap = movieFileMap;
			getOriginalFile = (item: UpgradeItem) => {
				const movieFile = mfMap.get(item.id);
				return {
					type: 'movie' as const,
					fileName: movieFile?.relativePath?.split('/').pop() ?? 'Unknown',
					formats: movieFile?.customFormats.map((cf) => cf.name) ?? [],
					score: item.score
				};
			};
		} else {
			const sonarr = client as SonarrClient;
			const [allSeries, profiles] = await Promise.all([
				sonarr.getAllSeries(),
				sonarr.getQualityProfiles()
			]);

			const profileMap = new Map(profiles.map((p) => [p.id, p]));

			tags = await sonarr.getTags();
			const tagMap = new Map(tags.map((t) => [t.id, t.label]));

			normalizedItems = normalizeSonarrItems(allSeries, profileMap, filter.cutoff, tagMap);
			totalItems = allSeries.length;

			getOriginalFile = (item: UpgradeItem) => ({
				type: 'series' as const,
				title: item.title,
				episodes: episodeFileCache.get(item.id) ?? []
			});
		}

		const fetchDurationMs = Date.now() - fetchStart;

		// =====================================================================
		// Steps 2-5: Filter, cooldown, selection (shared — works with UpgradeItem)
		// =====================================================================

		// Step 2: Apply filter rules
		const matchedItems = normalizedItems.filter((item) =>
			evaluateGroup(item as unknown as Record<string, unknown>, filter.group)
		);

		// Step 3: Filter by filter-level tag (items already searched by this filter)
		const tagLabel = resolveTagLabel(filter);

		if (isFilterExhausted(matchedItems, tags, tagLabel)) {
			const resetResult = await resetFilterCooldown(
				client as RadarrClient & SonarrClient,
				tagLabel
			);
			if (resetResult.reset > 0) {
				const updatedTags = await client.getTags();
				tags.length = 0;
				tags.push(...updatedTags);

				// Also strip the tag from local items so filterByFilterTag sees them as available
				const filterTagId = updatedTags.find(
					(t) => t.label.toLowerCase() === tagLabel.toLowerCase()
				)?.id;
				if (filterTagId !== undefined) {
					for (const item of matchedItems) {
						item._tags = item._tags.filter((id) => id !== filterTagId);
					}
				}
			}
		}

		const afterCooldownItems = filterByFilterTag(matchedItems, tags, tagLabel);
		const afterCooldownCount = afterCooldownItems.length;

		// Step 4: If dry run, also exclude items from previous dry runs
		let availableItems = afterCooldownItems;
		let dryRunExcludedCount = 0;
		if (dryRun) {
			const excluded = getDryRunExclusions(instance.id);
			if (excluded.size > 0) {
				availableItems = afterCooldownItems.filter((item) => !excluded.has(item.id));
				dryRunExcludedCount = afterCooldownCount - availableItems.length;
			}
		}

		// Step 5: Apply selector
		const selector = getSelector(filter.selector);
		const selectedItems: UpgradeItem[] = selector
			? selector.select(availableItems, filter.count)
			: availableItems.slice(0, filter.count);

		// Fetch episode files for selected Sonarr series (only for selected items, not whole library)
		if (!isRadarr && selectedItems.length > 0) {
			const sonarr = client as SonarrClient;
			for (const item of selectedItems) {
				try {
					const epFiles = await sonarr.getEpisodeFiles(item.id);
					const episodes: UpgradeOriginalEpisode[] = epFiles.map((f) => ({
						seasonNumber: f.seasonNumber,
						fileName: f.relativePath?.split('/').pop() ?? 'Unknown',
						formats: f.customFormats?.map((cf) => cf.name) ?? [],
						score: f.customFormatScore ?? 0
					}));
					episodeFileCache.set(item.id, episodes);
				} catch {
					episodeFileCache.set(item.id, []);
				}
			}
		}

		// =====================================================================
		// Step 6: Trigger search (app-specific)
		// =====================================================================
		let searchesTriggered = 0;
		let successful = 0;
		let failed = 0;
		const errors: string[] = [];
		const isDryRun = dryRun;
		const selectionItems: UpgradeSelectionItem[] = [];

		if (selectedItems.length > 0) {
			if (isDryRun) {
				// Dry run - interactive search to preview upgrades
				addDryRunExclusions(
					instance.id,
					selectedItems.map((item) => item.id)
				);

				for (const item of selectedItems) {
					const original = getOriginalFile(item);
					try {
						let bestRelease:
							| { title: string; customFormats: { name: string }[]; customFormatScore: number }
							| undefined;
						let searchedSeason: number | undefined;

						if (isRadarr) {
							const releases = await (client as RadarrClient).getReleases(item.id);
							bestRelease = releases.find((r) => r.approved && !r.rejected);
						} else {
							const series = item._raw as SonarrSeries;
							searchedSeason = pickSeasonForSearch(series);
							const releases = await (client as SonarrClient).getReleases(item.id, searchedSeason);
							bestRelease = releases.find((r) => r.approved && !r.rejected);
						}

						if (bestRelease && bestRelease.customFormatScore > item.score) {
							selectionItems.push({
								id: item.id,
								title: item.title,
								original,
								upgrades: [
									{
										release: bestRelease.title,
										formats: bestRelease.customFormats.map((cf) => cf.name),
										score: bestRelease.customFormatScore,
										...(searchedSeason != null ? { seasonNumber: searchedSeason } : {})
									}
								]
							});
							successful++;
						} else {
							selectionItems.push({
								id: item.id,
								title: item.title,
								original,
								upgrades: []
							});
						}
						searchesTriggered++;
					} catch (error) {
						selectionItems.push({
							id: item.id,
							title: item.title,
							original,
							upgrades: []
						});
						failed++;
						errors.push(
							`Failed to get releases for ${item.title}: ${error instanceof Error ? error.message : String(error)}`
						);
					}
				}
			} else {
				// Live mode - trigger search, wait, check queue
				try {
					const itemIds = selectedItems.map((item) => item.id);

					if (isRadarr) {
						// Radarr: batch search
						const radarr = client as RadarrClient;
						const searchCommand = await radarr.searchMovies(itemIds);
						await radarr.waitForCommand(searchCommand.id);
						searchesTriggered = itemIds.length;

						// Poll queue until results stabilize
						const queue = await pollQueue(() => radarr.getQueue(itemIds));
						const queueMap = new Map(queue.map((q) => [q.movieId, q]));

						for (const item of selectedItems) {
							const original = getOriginalFile(item);
							const grabbed = queueMap.get(item.id);
							if (grabbed) {
								selectionItems.push({
									id: item.id,
									title: item.title,
									original,
									upgrades: [
										{
											release: grabbed.title,
											formats: grabbed.customFormats.map((cf) => cf.name),
											score: grabbed.customFormatScore
										}
									]
								});
								successful++;
							} else {
								selectionItems.push({
									id: item.id,
									title: item.title,
									original,
									upgrades: []
								});
							}
						}

						// Apply filter tag
						const filterTag = await radarr.getOrCreateTag(tagLabel);
						const tagResult = await applyFilterTagToMovies(
							radarr,
							selectedItems.map((item) => item._raw as RadarrMovie),
							filterTag.id
						);
						failed = tagResult.failed;
						errors.push(...tagResult.errors);
					} else {
						// Sonarr: search one series at a time
						const sonarr = client as SonarrClient;

						for (const item of selectedItems) {
							const cmd = await sonarr.searchSeries(item.id);
							await sonarr.waitForCommand(cmd.id);
							searchesTriggered++;
						}

						// Poll queue until results stabilize
						const queue = await pollQueue(() => sonarr.getQueue(itemIds));
						// Group queue items by seriesId, deduplicate by release title
						const queueMap = new Map<number, typeof queue>();
						for (const q of queue) {
							const existing = queueMap.get(q.seriesId) ?? [];
							if (!existing.some((e) => e.title === q.title)) {
								existing.push(q);
							}
							queueMap.set(q.seriesId, existing);
						}

						for (const item of selectedItems) {
							const original = getOriginalFile(item);
							const grabbed = queueMap.get(item.id) ?? [];
							if (grabbed.length > 0) {
								selectionItems.push({
									id: item.id,
									title: item.title,
									original,
									upgrades: grabbed.map((g) => ({
										release: g.title,
										formats: g.customFormats.map((cf) => cf.name),
										score: g.customFormatScore,
										seasonNumber: g.seasonNumber
									}))
								});
								successful++;
							} else {
								selectionItems.push({
									id: item.id,
									title: item.title,
									original,
									upgrades: []
								});
							}
						}

						// Apply filter tag using bulk editor
						const filterTag = await sonarr.getOrCreateTag(tagLabel);
						const tagResult = await applyFilterTagToSeries(
							sonarr,
							selectedItems.map((item) => item._raw as SonarrSeries),
							filterTag.id
						);
						failed = tagResult.failed;
						errors.push(...tagResult.errors);
					}
				} catch (error) {
					failed = selectedItems.length;
					errors.push(`Search failed: ${error instanceof Error ? error.message : String(error)}`);

					for (const item of selectedItems) {
						selectionItems.push({
							id: item.id,
							title: item.title,
							original: getOriginalFile(item),
							upgrades: []
						});
					}
				}
			}
		}

		// =====================================================================
		// Step 7: Build log (shared)
		// =====================================================================
		const completedAt = new Date();
		const log: UpgradeJobLog = {
			id: logId,
			configId: config.id ?? 0,
			instanceId: instance.id,
			instanceName: instance.name,
			startedAt: startedAt.toISOString(),
			completedAt: completedAt.toISOString(),
			status: failed > 0 && successful === 0 ? 'failed' : failed > 0 ? 'partial' : 'success',
			config: {
				cron: config.cron,
				filterMode: config.filterMode,
				selectedFilter: filter.name,
				dryRun
			},
			library: {
				totalItems,
				fetchedFromCache: false,
				fetchDurationMs
			},
			filter: {
				id: filter.id,
				name: filter.name,
				rules: filter.group,
				matchedCount: matchedItems.length,
				afterCooldown: afterCooldownCount,
				dryRunExcluded: dryRunExcludedCount
			},
			selection: {
				method: filter.selector,
				requestedCount: filter.count,
				actualCount: selectedItems.length,
				items: selectionItems
			},
			results: {
				searchesTriggered,
				successful,
				failed,
				errors
			}
		};

		await logUpgradeRun(log);
		await sendUpgradeNotification(log, manual);

		return log;
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		await logUpgradeError(instance.id, instance.name, errorMessage);

		const log = createSkippedLog(config, instance, errorMessage, dryRun);
		log.id = logId;
		log.startedAt = startedAt.toISOString();
		log.completedAt = new Date().toISOString();
		log.status = 'failed';
		log.config.selectedFilter = filter?.name ?? '';
		log.filter.id = filter?.id ?? '';
		log.filter.name = filter?.name ?? '';

		return log;
	} finally {
		client.close();
	}
}
