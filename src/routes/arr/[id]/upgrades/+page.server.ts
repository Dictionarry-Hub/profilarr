import { error, fail } from '@sveltejs/kit';
import type { Actions, ServerLoad } from '@sveltejs/kit';
import { arrInstancesQueries } from '$db/queries/arrInstances.ts';
import { upgradeConfigsQueries } from '$db/queries/upgradeConfigs.ts';
import { upgradeRunsQueries } from '$db/queries/upgradeRuns.ts';
import { logger } from '$logger/logger.ts';
import type { FilterConfig, FilterMode } from '$shared/upgrades/filters.ts';
import { searchRateLimits, getRunsPerHour, calculateMaxCount } from '$shared/upgrades/filters.ts';
import { clearDryRunExclusions } from '$lib/server/upgrades/processor.ts';
import { logDryRunCacheCleared } from '$lib/server/upgrades/logger.ts';
import { scheduleUpgradeForInstance } from '$lib/server/jobs/init.ts';
import { upsertScheduledJob } from '$lib/server/jobs/queueService.ts';
import { buildJobDisplayName } from '$lib/server/jobs/display.ts';
import { validateCronExpression, calculateNextRun } from '$lib/server/jobs/scheduleUtils.ts';

/** In-memory rate limit for upgrade dry runs: Map<instanceId, lastDryRunTimestamp> */
const dryRunTimestamps = new Map<number, number>();
const DRY_RUN_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes

export const load: ServerLoad = ({ params }) => {
	const id = parseInt(params.id || '', 10);

	if (isNaN(id)) {
		error(404, `Invalid instance ID: ${params.id}`);
	}

	const instance = arrInstancesQueries.getById(id);

	if (!instance) {
		error(404, `Instance not found: ${id}`);
	}

	const config = upgradeConfigsQueries.getByArrInstanceId(id);

	// Load upgrade runs from database
	const upgradeRuns = upgradeRunsQueries.getByInstanceId(id);

	const { api_key: _, ...safeInstance } = instance;

	return {
		instance: safeInstance,
		config: config ?? null,
		upgradeRuns
	};
};

export const actions: Actions = {
	save: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const formData = await request.formData();

		try {
			const enabled = formData.get('enabled') === 'true';
			const cron = (formData.get('cron') as string) || '0 */6 * * *';
			const filterMode = (formData.get('filterMode') as FilterMode) || 'round_robin';
			const filtersJson = formData.get('filters') as string;
			const filters: FilterConfig[] = filtersJson ? JSON.parse(filtersJson) : [];

			// Validate cron expression
			const minInterval = searchRateLimits[instance.type]?.minIntervalMinutes ?? 10;
			const cronError = validateCronExpression(cron, minInterval);
			if (cronError) {
				return fail(400, { error: cronError });
			}

			// Validate filter counts against rate limits
			const rph = getRunsPerHour(cron);
			if (rph !== null) {
				const maxCount = calculateMaxCount(instance.type, rph);
				for (const f of filters) {
					if (f.count > maxCount) {
						return fail(400, {
							error: `Filter "${f.name}" count (${f.count}) exceeds max (${maxCount}) for this schedule.`
						});
					}
				}
			}

			const configData = {
				enabled,
				cron,
				filterMode,
				filters
			};

			upgradeConfigsQueries.upsert(id, configData);

			// Calculate and store next run time
			const nextRunAt = calculateNextRun(cron);
			if (nextRunAt) upgradeConfigsQueries.updateNextRunAt(id, nextRunAt);

			await logger.info(`Upgrade config saved for instance "${instance.name}"`, {
				source: 'upgrades',
				meta: { instanceId: id, instanceName: instance.name }
			});

			await logger.debug('Upgrade config details', {
				source: 'upgrades',
				meta: {
					instanceId: id,
					enabled,
					cron,
					filterMode,
					filterCount: filters.length,
					filters: filters.map((f: FilterConfig) => ({
						id: f.id,
						name: f.name,
						enabled: f.enabled,
						selector: f.selector,
						count: f.count,
						cutoff: f.cutoff
					}))
				}
			});

			// Full filter rules for debugging
			await logger.debug('Filter rules', {
				source: 'upgrades',
				meta: {
					filters: filters.map((f: FilterConfig) => ({
						name: f.name,
						rules: f.group
					}))
				}
			});

			scheduleUpgradeForInstance(id);

			return { success: true };
		} catch (err) {
			await logger.error('Failed to save upgrade config', {
				source: 'upgrades',
				meta: { instanceId: id, error: err }
			});
			return fail(500, { error: 'Failed to save configuration' });
		}
	},

	run: async ({ params, request }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		if (!instance) {
			return fail(404, { error: 'Instance not found' });
		}

		const config = upgradeConfigsQueries.getByArrInstanceId(id);
		if (!config) {
			return fail(404, { error: 'No upgrade configuration found. Save a configuration first.' });
		}

		if (config.filters.length === 0) {
			return fail(400, { error: 'No filters configured. Add at least one filter.' });
		}

		const enabledFilters = config.filters.filter((f: FilterConfig) => f.enabled);
		if (enabledFilters.length === 0) {
			return fail(400, { error: 'No enabled filters. Enable at least one filter.' });
		}

		const formData = await request.formData();
		const dryRun = formData.get('dryRun') === 'true';

		// Rate limit dry runs to once per 10 minutes per instance
		if (dryRun) {
			const lastDryRun = dryRunTimestamps.get(id);
			if (lastDryRun && Date.now() - lastDryRun < DRY_RUN_COOLDOWN_MS) {
				const remainingMs = DRY_RUN_COOLDOWN_MS - (Date.now() - lastDryRun);
				const remainingMin = Math.ceil(remainingMs / 60000);
				await logger.warn(
					`Dry run cooldown active for "${instance.name}" - ${remainingMin}m remaining`,
					{
						source: 'upgrades',
						meta: { instanceId: id, instanceName: instance.name, remainingMin }
					}
				);
				return fail(400, {
					error: `Dry run cooldown active. Try again in ${remainingMin} minute${remainingMin !== 1 ? 's' : ''}.`
				});
			}
		}

		try {
			const queued = upsertScheduledJob({
				jobType: 'arr.upgrade',
				runAt: new Date().toISOString(),
				payload: { instanceId: id, dryRun },
				source: 'manual',
				dedupeKey: `arr.upgrade.manual:${id}`
			});

			if (dryRun) {
				dryRunTimestamps.set(id, Date.now());
			}

			await logger.info(`Manual upgrade run queued for "${instance.name}"`, {
				source: 'upgrades',
				meta: {
					jobId: queued.id,
					instanceId: id,
					instanceName: instance.name,
					displayName: buildJobDisplayName('arr.upgrade', { instanceId: id }),
					dryRun
				}
			});

			return { success: true, queued: true };
		} catch (err) {
			await logger.error('Manual upgrade run failed', {
				source: 'upgrades',
				meta: { instanceId: id, error: err }
			});

			return fail(500, { error: 'Upgrade run failed. Check logs for details.' });
		}
	},

	clearCache: async ({ params }) => {
		const id = parseInt(params.id || '', 10);

		if (isNaN(id)) {
			return fail(400, { error: 'Invalid instance ID' });
		}

		const instance = arrInstancesQueries.getById(id);
		const instanceName = instance?.name ?? `Instance ${id}`;

		const clearedIds = clearDryRunExclusions(id);
		await logDryRunCacheCleared(id, instanceName, clearedIds);

		return { success: true, cacheCleared: true };
	}
};
