<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import type { FilterConfig, FilterMode } from '$shared/upgrades/filters';
	import { searchRateLimits, getRunsPerHour } from '$shared/upgrades/filters';
	import { enhance } from '$app/forms';
	import { onMount } from 'svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import { isDirty, initEdit, update, current, clear } from '$lib/client/stores/dirty';
	import {
		Info,
		Save,
		Play,
		RotateCcw,
		Settings,
		SlidersHorizontal,
		History,
		FlaskConical
	} from 'lucide-svelte';
	import CoreSettings from './components/CoreSettings.svelte';
	import FilterSettings from './components/FilterSettings.svelte';
	import RunHistory from './components/RunHistory.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';

	export let data: PageData;
	export let form: ActionData;

	// Initialize dirty tracking on mount (same pattern as sync page)
	onMount(() => {
		const initialFormData = {
			enabled: data.config?.enabled ?? false,
			cron: data.config?.cron ?? '0 */6 * * *',
			filterMode: (data.config?.filterMode ?? 'round_robin') as FilterMode,
			filters: JSON.stringify(data.config?.filters ?? [])
		};
		// Always use initEdit - isDirty should be false until user makes changes
		initEdit(initialFormData);
		return () => clear();
	});

	// Track if config exists
	$: isNewConfig = !data.config;

	// Dev mode check - use VITE_CHANNEL which is explicitly set in dev mode
	const isDev = import.meta.env.VITE_CHANNEL === 'dev';

	let saving = false;
	let running = false;
	let clearing = false;

	// Read current values from dirty store (same pattern as working pages)
	$: enabled = ($current.enabled ?? false) as boolean;
	$: cron = ($current.cron ?? '0 */6 * * *') as string;
	$: filterMode = ($current.filterMode ?? 'round_robin') as FilterMode;
	$: filters = JSON.parse(($current.filters ?? '[]') as string) as FilterConfig[];

	// Derive runs per hour for dynamic count limits
	$: runsPerHour = getRunsPerHour(cron) ?? 1;
	$: appMinInterval = searchRateLimits[data.instance.type]?.minIntervalMinutes ?? 10;

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
			alertStore.add('error', form.error);
		}
	}
</script>

<svelte:head>
	<title>{data.instance.name} - Upgrades - Profilarr</title>
</svelte:head>

<StickyCard position="top">
	<div slot="left">
		<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Upgrades</h1>
		<p class="text-sm text-neutral-500 dark:text-neutral-400">
			Automatically search for better quality releases.
		</p>
	</div>
	<div slot="right" class="flex flex-wrap items-center gap-2">
		<Button text="Info" icon={Info} href="/arr/upgrades/info" />
		{#if !isNewConfig}
			<Tooltip text="Clear dry run exclusion cache so items can be re-selected">
				<Button
					text={clearing ? 'Clearing...' : 'Reset Cache'}
					icon={RotateCcw}
					disabled={clearing || running || saving}
					on:click={() => {
						const f = document.getElementById('clear-cache-form');
						if (f instanceof HTMLFormElement) f.requestSubmit();
					}}
				/>
			</Tooltip>
			<Tooltip text="Search indexers without downloading (limited to once every 10 min)">
				<Button
					text={running ? 'Running...' : 'Dry Run'}
					icon={FlaskConical}
					iconColor="text-amber-600 dark:text-amber-400"
					disabled={running || saving || clearing || $isDirty}
					on:click={() => {
						const f = document.getElementById('dry-run-form');
						if (f instanceof HTMLFormElement) f.requestSubmit();
					}}
				/>
			</Tooltip>
			{#if isDev}
				<Tooltip text="Run a live search that will download upgrades">
					<Button
						text={running ? 'Running...' : 'Live Run'}
						icon={Play}
						iconColor="text-red-600 dark:text-red-400"
						disabled={running || saving || $isDirty}
						on:click={() => {
							const f = document.getElementById('live-run-form');
							if (f instanceof HTMLFormElement) f.requestSubmit();
						}}
					/>
				</Tooltip>
			{/if}
		{/if}
		<Button
			text={saving ? 'Saving...' : 'Save'}
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

<div class="mt-6 space-y-6">
	<section>
		<h2
			class="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
		>
			<Settings size={18} class="text-neutral-500 dark:text-neutral-400" />
			Settings
		</h2>
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

	<section>
		<h2
			class="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
		>
			<SlidersHorizontal size={18} class="text-neutral-500 dark:text-neutral-400" />
			Filters
		</h2>
		<FilterSettings
			{filters}
			appType={data.instance.type}
			{runsPerHour}
			onFiltersChange={(v) => update('filters', JSON.stringify(v))}
		/>
	</section>
</div>

<section class="mt-6">
	<h2
		class="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
	>
		<History size={18} class="text-neutral-500 dark:text-neutral-400" />
		Run History
	</h2>
	<RunHistory runs={data.upgradeRuns} />
</section>

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
