<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { formatSmartDateTime } from '$shared/utils/dates';
	import { serverTimezone } from '$lib/client/stores/timezone';
	import FormInput from '$ui/form/FormInput.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import Label from '$ui/label/Label.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';

	export let enabled: boolean = false;
	export let renameFolders: boolean = false;
	export let ignoreTag: string = '';
	export let cron: string = '0 0 * * *';
	export let summaryNotifications: boolean = true;
	export let lastRunAt: string | null = null;
	export let nextRunAt: string | null = null;
	export let minIntervalMinutes: number = 10;

	export let onEnabledChange: ((value: boolean) => void) | undefined = undefined;
	export let onRenameFoldersChange: ((value: boolean) => void) | undefined = undefined;
	export let onIgnoreTagChange: ((value: string) => void) | undefined = undefined;
	export let onCronChange: ((value: string) => void) | undefined = undefined;
	export let onSummaryNotificationsChange: ((value: boolean) => void) | undefined = undefined;
	export let onWarning: ((message: string) => void) | undefined = undefined;

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
</script>

<div class="flex flex-wrap gap-4 md:items-end md:gap-x-5 md:gap-y-3 md:px-4">
	<div>
		<span
			class="mb-1 block text-[10px] font-medium tracking-wider text-neutral-400 uppercase dark:text-neutral-500"
		>
			Status
		</span>
		<Toggle
			checked={enabled}
			label={enabled ? 'Enabled' : 'Disabled'}
			color={enabled ? 'green' : 'red'}
			on:change={(e) => onEnabledChange?.(e.detail)}
		/>
	</div>

	<div data-onboarding="rename-folders">
		<span
			class="mb-1 block text-[10px] font-medium tracking-wider text-neutral-400 uppercase dark:text-neutral-500"
		>
			Folders
		</span>
		<Toggle
			checked={renameFolders}
			label={renameFolders ? 'On' : 'Off'}
			color={renameFolders ? 'accent' : 'neutral'}
			disabled={!enabled}
			on:change={(e) => onRenameFoldersChange?.(e.detail)}
		/>
	</div>

	<div data-onboarding="rename-summary">
		<span
			class="mb-1 block text-[10px] font-medium tracking-wider text-neutral-400 uppercase dark:text-neutral-500"
		>
			Summary
		</span>
		<Toggle
			checked={summaryNotifications}
			label={summaryNotifications ? 'On' : 'Off'}
			color={summaryNotifications ? 'accent' : 'neutral'}
			disabled={!enabled}
			on:change={(e) => onSummaryNotificationsChange?.(e.detail)}
		/>
	</div>

	<div data-onboarding="rename-schedule">
		<span
			class="mb-1 block text-[10px] font-medium tracking-wider text-neutral-400 uppercase dark:text-neutral-500"
		>
			Schedule
		</span>
		<CronInput bind:value={cronValue} disabled={!enabled} {minIntervalMinutes} {onWarning} />
	</div>

	<div data-onboarding="rename-ignore-tag">
		<span
			class="mb-1 block text-[10px] font-medium tracking-wider text-neutral-400 uppercase dark:text-neutral-500"
		>
			Ignore Tag
		</span>
		<FormInput
			label="Ignore Tag"
			hideLabel
			lowercase
			name="ignore-tag"
			size="md"
			value={ignoreTag}
			placeholder="no-rename"
			disabled={!enabled}
			on:input={(e) => onIgnoreTagChange?.(e.detail)}
		/>
	</div>

	{#if lastRunAt}
		<div
			class="flex w-full flex-wrap items-center gap-1.5 border-t border-neutral-200 pt-3 md:ml-auto md:w-auto md:border-0 md:pt-0 dark:border-neutral-800"
		>
			{#if !enabled}
				<Label variant="warning" size="md" rounded="md">Paused</Label>
			{:else if timeUntilNext !== null && timeUntilNext <= 0}
				<Label variant="success" size="md" rounded="md">Ready</Label>
			{:else if timeUntilNext !== null}
				<Label variant="secondary" size="md" rounded="md" mono>
					Next {formatTimeRemaining(timeUntilNext)}
				</Label>
			{/if}
			<Label variant="secondary" size="md" rounded="md" mono>
				Last {formatSmartDateTime(lastRunAt, $serverTimezone)}
			</Label>
		</div>
	{/if}
</div>
