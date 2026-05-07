<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { DynamicFilterOptions, FilterConfig, FilterMode } from '$shared/upgrades/filters';
	import {
		createEmptyDynamicFilterOptions,
		searchRateLimits,
		getRunsPerHour
	} from '$shared/upgrades/filters';
	import { enhance } from '$app/forms';
	import { browser } from '$app/environment';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import { isDirty, initEdit, update, current, clear } from '$lib/client/stores/dirty';
	import { jobStatus } from '$stores/jobStatus';
	import { Info, Save, Play, RotateCcw, FlaskConical } from 'lucide-svelte';
	import CoreSettings from './components/CoreSettings.svelte';
	import FilterSettings from './components/FilterSettings.svelte';
	import RunHistory from './components/RunHistory.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import Admonition from '$ui/admonition/Admonition.svelte';

	export let data: PageData;
	export let form: ActionData;

	const RATE_LIMITS_KEY = 'upgrades.dismissed.rateLimits.v1';
	const WHEN_TO_USE_KEY = 'upgrades.dismissed.whenToUse.v1';

	let showRateLimitsAdmonition = true;
	let showWhenToUseAdmonition = true;

	function dismissRateLimits() {
		localStorage.setItem(RATE_LIMITS_KEY, '1');
		showRateLimitsAdmonition = false;
	}

	function dismissWhenToUse() {
		localStorage.setItem(WHEN_TO_USE_KEY, '1');
		showWhenToUseAdmonition = false;
	}

	// Initialize dirty tracking on mount (same pattern as sync page)
	onMount(() => {
		if (browser) {
			showRateLimitsAdmonition = localStorage.getItem(RATE_LIMITS_KEY) !== '1';
			showWhenToUseAdmonition = localStorage.getItem(WHEN_TO_USE_KEY) !== '1';
		}
		const initialFormData = {
			enabled: data.config?.enabled ?? false,
			cron: data.config?.cron ?? '0 */6 * * *',
			filterMode: (data.config?.filterMode ?? 'round_robin') as FilterMode,
			filters: JSON.stringify(data.config?.filters ?? [])
		};
		// Always use initEdit - isDirty should be false until user makes changes
		initEdit(initialFormData);
		let previousJobState: string | null = null;
		const unsubscribeJobStatus = jobStatus.subscribe((status) => {
			if (
				previousJobState === 'running' &&
				status.state === 'completed' &&
				status.jobType === 'arr.upgrade'
			) {
				invalidateAll();
			}
			previousJobState = status.state;
		});
		return () => {
			unsubscribeJobStatus();
			clear();
		};
	});

	// Track if config exists
	$: isNewConfig = !data.config;

	// Dev mode check - use VITE_CHANNEL which is explicitly set in dev mode
	const isDev = import.meta.env.VITE_CHANNEL === 'dev';

	let saving = false;
	let running = false;
	let clearing = false;
	let dynamicFilterOptions: DynamicFilterOptions = createEmptyDynamicFilterOptions(
		data.instance.type
	);
	let dynamicFilterOptionsLoading = true;
	let dynamicFilterOptionsPromise: unknown = null;
	let dynamicFilterOptionsVersion = 0;

	// Read current values from dirty store (same pattern as working pages)
	$: enabled = ($current.enabled ?? false) as boolean;
	$: cron = ($current.cron ?? '0 */6 * * *') as string;
	$: filterMode = ($current.filterMode ?? 'round_robin') as FilterMode;
	$: filters = JSON.parse(($current.filters ?? '[]') as string) as FilterConfig[];

	// Derive runs per hour for dynamic count limits
	$: runsPerHour = getRunsPerHour(cron) ?? 1;
	$: appMinInterval = searchRateLimits[data.instance.type]?.minIntervalMinutes ?? 10;

	$: if (browser && dynamicFilterOptionsPromise !== data.dynamicFilterOptions) {
		dynamicFilterOptionsPromise = data.dynamicFilterOptions;
		dynamicFilterOptions = createEmptyDynamicFilterOptions(data.instance.type);
		dynamicFilterOptionsLoading = true;
		dynamicFilterOptionsVersion += 1;
		const promise = dynamicFilterOptionsPromise;

		Promise.resolve(data.dynamicFilterOptions)
			.then((options) => {
				if (dynamicFilterOptionsPromise !== promise) return;
				dynamicFilterOptions = options;
				dynamicFilterOptionsLoading = false;
				dynamicFilterOptionsVersion += 1;
			})
			.catch(() => {
				if (dynamicFilterOptionsPromise !== promise) return;
				dynamicFilterOptions = createEmptyDynamicFilterOptions(data.instance.type);
				dynamicFilterOptionsLoading = false;
				dynamicFilterOptionsVersion += 1;
			});
	}

	// Handle form response - use a processed flag to avoid re-running on field changes
	let lastFormId: unknown = null;
	$: if (form && form !== lastFormId) {
		lastFormId = form;
		if (form.success && !form.queued && !form.cacheCleared) {
			alertStore.add('success', 'Configuration saved successfully');
			initEdit({ enabled, cron, filterMode, filters: JSON.stringify(filters) });
		}
		if (form.success && form.queued) {
			alertStore.add('success', 'Upgrade run queued');
		}
		if (form.success && form.cacheCleared) {
			alertStore.add('success', 'Dry run cache cleared');
		}
		if (form.error) {
			jobStatus.cancelOptimistic();
			alertStore.add('error', form.error);
		}
	}
</script>

<svelte:head>
	<title>{data.instance.name} - Upgrades - Profilarr</title>
</svelte:head>

{#key data.instance.id}
	<StickyCard position="top">
		<div slot="left">
			<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Upgrades</h1>
			<p class="text-sm text-neutral-500 dark:text-neutral-400">
				Automatically search for better quality releases.
			</p>
		</div>
		<div slot="right" class="flex flex-wrap items-center gap-2">
			<Button text="Info" icon={Info} href="/arr/upgrades/info" />
			<Button
				text={clearing ? 'Clearing...' : 'Reset Cache'}
				icon={RotateCcw}
				disabled={isNewConfig || !enabled || clearing || running || saving}
				tooltip="Clear dry run exclusion cache so items can be re-selected"
				tooltipPosition="bottom"
				tooltipAlign="right"
				on:click={() => {
					const f = document.getElementById('clear-cache-form');
					if (f instanceof HTMLFormElement) f.requestSubmit();
				}}
			/>
			<Button
				text={running ? 'Running...' : 'Dry Run'}
				icon={FlaskConical}
				iconColor="text-amber-600 dark:text-amber-400"
				disabled={isNewConfig || !enabled || running || saving || clearing || $isDirty}
				tooltip="Search indexers without downloading (limited to once every 10 min)"
				tooltipPosition="bottom"
				tooltipAlign="right"
				on:click={() => {
					jobStatus.connect();
					jobStatus.setRunning('arr.upgrade', 'Running upgrades...');
					const f = document.getElementById('dry-run-form');
					if (f instanceof HTMLFormElement) {
						f.requestSubmit();
					} else {
						jobStatus.cancelOptimistic();
					}
				}}
			/>
			{#if isDev}
				<Button
					text={running ? 'Running...' : 'Live Run'}
					icon={Play}
					iconColor="text-red-600 dark:text-red-400"
					disabled={isNewConfig || !enabled || running || saving || $isDirty}
					tooltip="Run a live search that will download upgrades"
					tooltipPosition="bottom"
					tooltipAlign="right"
					on:click={() => {
						jobStatus.connect();
						jobStatus.setRunning('arr.upgrade', 'Running upgrades...');
						const f = document.getElementById('live-run-form');
						if (f instanceof HTMLFormElement) {
							f.requestSubmit();
						} else {
							jobStatus.cancelOptimistic();
						}
					}}
				/>
			{/if}
			<Button
				text="Save"
				icon={Save}
				iconColor="text-blue-600 dark:text-blue-400"
				disabled={saving || running || !$isDirty}
				on:click={() => {
					const f = document.getElementById('save-form');
					if (f instanceof HTMLFormElement) f.requestSubmit();
				}}
			/>
		</div>
	</StickyCard>

	<div class="mt-4 space-y-6">
		{#if showRateLimitsAdmonition}
			<div class="md:px-4">
				<Admonition
					variant="danger"
					title="Indexer rate limits"
					dismissible
					confirmDismiss
					confirmMessage="This warning will be permanently hidden. Make sure you have read it."
					on:dismiss={dismissRateLimits}
				>
					<p>
						Profilarr limits upgrade searches to at most one movie every 10 minutes (Radarr) and one
						series per hour (Sonarr). These are intentionally conservative defaults, but they don't
						override your indexer's own rules. Confirm what your indexer allows and stay within it.
					</p>
				</Admonition>
			</div>
		{/if}

		{#if showWhenToUseAdmonition}
			<div class="md:px-4">
				<Admonition
					variant="info"
					title="When to use upgrades"
					dismissible
					confirmDismiss
					confirmMessage="This message will be permanently hidden. Make sure you have read it."
					on:dismiss={dismissWhenToUse}
				>
					<p class="mb-2">
						Most libraries don't need upgrades running. RSS already grabs better releases as they're
						posted; this feature only matters when your existing library has fallen behind your
						current config. Turn it on to catch up after a change, for example:
					</p>
					<ul class="list-disc space-y-1 pl-5">
						<li>You switched a library to a different quality profile</li>
						<li>Your custom format scores changed, often after a PCD update</li>
						<li>
							Your Arr instance was offline for a stretch (internet outage, downtime, updates)
						</li>
						<li>You added a new indexer with releases you couldn't reach before</li>
					</ul>
					<p class="mt-2">If none of those apply, leaving it disabled is fine.</p>
				</Admonition>
			</div>
		{/if}

		<section class="border-b border-neutral-200 pb-5 dark:border-neutral-800">
			<CoreSettings
				{enabled}
				{cron}
				{filterMode}
				lastRunAt={data.config?.lastRunAt ?? null}
				nextRunAt={data.config?.nextRunAt ?? null}
				minIntervalMinutes={appMinInterval}
				onEnabledChange={(v) => update('enabled', v)}
				onCronChange={(v) => update('cron', v)}
				onFilterModeChange={(v) => update('filterMode', v)}
				onWarning={(msg) => alertStore.add('warning', msg)}
			/>
		</section>

		{#if enabled}
			<section class="md:px-4" data-onboarding="upgrades-filters">
				<FilterSettings
					{filters}
					appType={data.instance.type}
					{runsPerHour}
					{dynamicFilterOptions}
					{dynamicFilterOptionsLoading}
					{dynamicFilterOptionsVersion}
					onFiltersChange={(v) => update('filters', JSON.stringify(v))}
				/>
			</section>

			<section class="md:px-4">
				<RunHistory runs={data.upgradeRuns} />
			</section>
		{:else}
			<section class="md:px-4">
				<div class="rounded-xl border border-neutral-300 dark:border-neutral-700/60">
					<p class="px-4 py-4 text-center text-sm text-neutral-600 dark:text-neutral-400">
						Enable upgrades to configure filters and view run history.
					</p>
				</div>
			</section>
		{/if}
	</div>

	<!-- Hidden forms -->
	<form
		id="save-form"
		method="POST"
		action="?/save"
		class="hidden"
		use:enhance={() => {
			saving = true;
			return async ({ update }) => {
				await update({ reset: false });
				saving = false;
			};
		}}
	>
		<input type="hidden" name="enabled" value={enabled} />
		<input type="hidden" name="cron" value={cron} />
		<input type="hidden" name="filterMode" value={filterMode} />
		<input type="hidden" name="filters" value={JSON.stringify(filters)} />
	</form>
	{#if !isNewConfig}
		<form
			id="dry-run-form"
			method="POST"
			action="?/run"
			class="hidden"
			use:enhance={() => {
				running = true;
				return async ({ update }) => {
					await update({ reset: false });
					running = false;
				};
			}}
		>
			<input type="hidden" name="dryRun" value="true" />
		</form>
		<form
			id="live-run-form"
			method="POST"
			action="?/run"
			class="hidden"
			use:enhance={() => {
				running = true;
				return async ({ update }) => {
					await update({ reset: false });
					running = false;
				};
			}}
		>
			<input type="hidden" name="dryRun" value="false" />
		</form>
		<form
			id="clear-cache-form"
			method="POST"
			action="?/clearCache"
			class="hidden"
			use:enhance={() => {
				clearing = true;
				return async ({ update }) => {
					await update({ reset: false });
					clearing = false;
				};
			}}
		></form>
	{/if}

	<DirtyModal />
{/key}
