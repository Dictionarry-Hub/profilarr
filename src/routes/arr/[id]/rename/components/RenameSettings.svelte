<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { parseUTC } from '$shared/utils/dates';
	import FormInput from '$ui/form/FormInput.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
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
	<!-- Mobile: stacked, Desktop: inline flex -->
	<div class="flex flex-col gap-3 md:flex-row md:flex-wrap md:items-center md:gap-x-6">
		<!-- Status -->
		<div>
			<span class="mb-1 block text-sm text-neutral-500 md:hidden dark:text-neutral-400">Status</span
			>
			<div class="md:flex md:items-center md:gap-2">
				<span class="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400">Status:</span>
				<Toggle
					checked={enabled}
					label={enabled ? 'Enabled' : 'Disabled'}
					fullWidth
					color={enabled ? 'green' : 'red'}
					on:change={(e) => onEnabledChange?.(e.detail)}
				/>
			</div>
		</div>

		<!-- Rename Folders -->
		<div data-onboarding="rename-folders">
			<span class="mb-1 block text-sm text-neutral-500 md:hidden dark:text-neutral-400"
				>Folders</span
			>
			<div class="md:flex md:items-center md:gap-2">
				<span class="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400">Folders:</span
				>
				<Toggle
					checked={renameFolders}
					label={renameFolders ? 'On' : 'Off'}
					fullWidth
					color={renameFolders ? 'accent' : 'neutral'}
					on:change={(e) => onRenameFoldersChange?.(e.detail)}
				/>
			</div>
		</div>

		<!-- Summary Notifications -->
		<div data-onboarding="rename-summary">
			<span class="mb-1 block text-sm text-neutral-500 md:hidden dark:text-neutral-400"
				>Summary</span
			>
			<div class="md:flex md:items-center md:gap-2">
				<span class="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400">Summary:</span
				>
				<Toggle
					checked={summaryNotifications}
					label={summaryNotifications ? 'On' : 'Off'}
					fullWidth
					color={summaryNotifications ? 'accent' : 'neutral'}
					on:change={(e) => onSummaryNotificationsChange?.(e.detail)}
				/>
			</div>
		</div>

		<!-- Divider (desktop only) -->
		<div class="hidden h-6 w-px bg-neutral-200 md:block dark:bg-neutral-700"></div>

		<!-- Schedule -->
		<div data-onboarding="rename-schedule">
			<span class="mb-1 block text-sm text-neutral-500 md:hidden dark:text-neutral-400"
				>Schedule</span
			>
			<div class="md:flex md:items-center md:gap-2">
				<span class="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400"
					>Schedule:</span
				>
				<CronInput bind:value={cronValue} {minIntervalMinutes} {onWarning} />
			</div>
		</div>

		<!-- Ignore Tag -->
		<div data-onboarding="rename-ignore-tag">
			<span class="mb-1 block text-sm text-neutral-500 md:hidden dark:text-neutral-400"
				>Ignore Tag</span
			>
			<div class="md:flex md:items-center md:gap-2">
				<span class="hidden text-sm text-neutral-500 md:inline dark:text-neutral-400"
					>Ignore Tag:</span
				>
				<FormInput
					label="Ignore Tag"
					hideLabel
					lowercase
					name="ignore-tag"
					size="md"
					value={ignoreTag}
					placeholder="no-rename"
					on:input={(e) => onIgnoreTagChange?.(e.detail)}
				/>
			</div>
		</div>

		<!-- Run status (right-aligned on desktop, full-width row on mobile) -->
		{#if lastRunAt}
			<div
				class="flex flex-wrap items-center gap-3 border-t border-neutral-200 pt-3 text-xs text-neutral-500 md:ml-auto md:border-0 md:pt-0 dark:border-neutral-700 dark:text-neutral-400"
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
