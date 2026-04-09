<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { filterModes, type FilterMode } from '$shared/upgrades/filters';
	import { parseUTC } from '$shared/utils/dates';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';

	export let enabled: boolean = true;
	export let cron: string = '0 */6 * * *';
	export let filterMode: FilterMode = 'round_robin';
	export let lastRunAt: string | null = null;
	export let nextRunAt: string | null = null;
	export let minIntervalMinutes: number = 10;

	export let onEnabledChange: ((value: boolean) => void) | undefined = undefined;
	export let onCronChange: ((value: string) => void) | undefined = undefined;
	export let onFilterModeChange: ((value: FilterMode) => void) | undefined = undefined;
	export let onWarning: ((message: string) => void) | undefined = undefined;

	// Map filterModes to DropdownSelect format
	$: modeOptions = filterModes.map((m) => ({ value: m.id, label: m.label }));

	// Track cron changes from CronInput
	let cronValue = cron;
	$: cronValue = cron; // sync from parent
	$: if (cronValue !== cron) {
		onCronChange?.(cronValue);
	}

	// Cooldown tracking
	let now = Date.now();
	let interval: ReturnType<typeof setInterval>;

	onMount(() => {
		interval = setInterval(() => {
			now = Date.now();
		}, 1000);
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	$: nextRunTime = nextRunAt ? new Date(nextRunAt).getTime() : null;
	$: timeUntilNext = nextRunTime ? nextRunTime - now : null;

	function formatTimeRemaining(ms: number): string {
		if (ms <= 0) return 'now';
		const seconds = Math.floor(ms / 1000);
		const minutes = Math.floor(seconds / 60);
		const hours = Math.floor(minutes / 60);
		if (hours > 0) {
			const remainingMinutes = minutes % 60;
			return `${hours}h ${remainingMinutes}m`;
		}
		if (minutes > 0) {
			return `${minutes}m`;
		}
		return `${seconds}s`;
	}

	function formatLastRun(isoString: string): string {
		const date = parseUTC(isoString);
		if (!date) return '-';
		const today = new Date();
		const yesterday = new Date(today);
		yesterday.setDate(yesterday.getDate() - 1);

		let dateStr: string;
		if (date.toDateString() === today.toDateString()) {
			dateStr = 'Today';
		} else if (date.toDateString() === yesterday.toDateString()) {
			dateStr = 'Yesterday';
		} else {
			dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
		}

		const timeStr = date.toLocaleTimeString('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			hour12: true
		});

		return `${dateStr}, ${timeStr}`;
	}
</script>

<div
	class="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
>
	<div class="flex flex-wrap gap-4 md:items-end md:gap-6">
		<!-- Status -->
		<div>
			<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Status</span>
			<Toggle
				checked={enabled}
				label={enabled ? 'Enabled' : 'Disabled'}
				color={enabled ? 'green' : 'red'}
				on:change={(e) => onEnabledChange?.(e.detail)}
			/>
		</div>

		<!-- Schedule -->
		<div data-onboarding="upgrades-schedule">
			<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Schedule</span>
			<CronInput bind:value={cronValue} {minIntervalMinutes} {onWarning} />
		</div>

		<!-- Filter Mode -->
		<div data-onboarding="upgrades-filter-mode">
			<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Mode</span>
			<DropdownSelect
				value={filterMode}
				options={modeOptions}
				minWidth="10rem"
				on:change={(e) => onFilterModeChange?.(e.detail as FilterMode)}
			/>
		</div>

		<!-- Run status -->
		{#if lastRunAt}
			<div
				class="flex w-full flex-wrap items-center gap-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500 md:ml-auto md:w-auto md:border-0 md:pt-0 dark:border-neutral-700 dark:text-neutral-400"
			>
				{#if !enabled}
					<span
						class="rounded bg-amber-100 px-1.5 py-0.5 font-medium text-amber-700 dark:bg-amber-900/50 dark:text-amber-400"
						>Paused</span
					>
				{:else if timeUntilNext !== null && timeUntilNext <= 0}
					<span
						class="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-700 dark:bg-green-900/50 dark:text-green-400"
						>Ready</span
					>
				{:else if timeUntilNext !== null}
					<span>
						Next: <span
							class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
							>{formatTimeRemaining(timeUntilNext)}</span
						>
					</span>
				{/if}
				<span>
					Last: <span
						class="rounded bg-neutral-100 px-1.5 py-0.5 font-mono text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
						>{formatLastRun(lastRunAt)}</span
					>
				</span>
			</div>
		{/if}
	</div>
</div>
