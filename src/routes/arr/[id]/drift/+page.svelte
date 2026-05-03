<script lang="ts">
	import { enhance } from '$app/forms';
	import type { ActionData, PageData } from './$types';
	import { onDestroy, onMount } from 'svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import { initEdit, update as updateDirty, clear, isDirty } from '$lib/client/stores/dirty';
	import { formatSmartDateTime } from '$shared/utils/dates';
	import { serverTimezone } from '$lib/client/stores/timezone';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import { ArrowLeftRight, Loader2, Play, Save, Settings } from 'lucide-svelte';
	import DriftDetection from './components/DriftDetection.svelte';

	export let data: PageData;
	export let form: ActionData;

	let saving = false;
	let running = false;
	let lastFormId: unknown = null;
	let enabled = data.settings.enabled;
	let cron = data.settings.cron;
	let nextRunAt = data.settings.nextRunAt;
	let now = Date.now();
	let interval: ReturnType<typeof setInterval>;

	onMount(() => {
		initEdit({ enabled, cron });
		interval = setInterval(() => {
			now = Date.now();
		}, 1000);
		return () => {
			clear();
			if (interval) clearInterval(interval);
		};
	});

	onDestroy(() => {
		if (interval) clearInterval(interval);
	});

	$: updateDirty('enabled', enabled);
	$: updateDirty('cron', cron);
	$: nextRunTime = nextRunAt ? new Date(nextRunAt).getTime() : null;
	$: timeUntilNext = nextRunTime ? nextRunTime - now : null;

	$: if (form && form !== lastFormId) {
		lastFormId = form;
		if (form.success && form.queued) {
			alertStore.add('success', 'Drift check queued');
		}
		if (form.success && !form.queued) {
			if (form.nextRunAt || form.nextRunAt === null) nextRunAt = form.nextRunAt;
			alertStore.add('success', 'Drift detection settings saved');
			initEdit({ enabled, cron });
		}
		if (form.error) {
			alertStore.add('error', form.error);
		}
	}

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

<svelte:head>
	<title>{data.instance.name} - Drift - Profilarr</title>
</svelte:head>

{#key data.instance.id}
	<StickyCard position="top">
		<div slot="left">
			<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Drift</h1>
			<p class="text-sm text-neutral-500 dark:text-neutral-400">
				Compare synced configuration against the current Arr state.
			</p>
		</div>
		<div slot="right" class="flex items-center gap-2">
			<Button
				text={running ? 'Running...' : 'Run Now'}
				icon={Play}
				iconColor="text-green-600 dark:text-green-400"
				disabled={saving || running || $isDirty || !data.featureEnabled || !enabled}
				on:click={() => {
					const runForm = document.getElementById('drift-run-form');
					if (runForm instanceof HTMLFormElement) {
						runForm.requestSubmit();
					}
				}}
			/>
			<Button
				text={saving ? 'Saving...' : 'Save'}
				icon={saving ? Loader2 : Save}
				iconColor={saving
					? 'text-blue-600 dark:text-blue-400 animate-spin'
					: 'text-blue-600 dark:text-blue-400'}
				disabled={saving || !$isDirty || !data.featureEnabled}
				on:click={() => {
					const saveForm = document.getElementById('drift-save-form');
					if (saveForm instanceof HTMLFormElement) {
						saveForm.requestSubmit();
					}
				}}
			/>
		</div>
	</StickyCard>

	<div class="mt-6 space-y-6 pb-32">
		<section>
			<h2
				class="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
			>
				<Settings size={18} class="text-neutral-500 dark:text-neutral-400" />
				Settings
			</h2>
			<div
				class="rounded-lg border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900"
			>
				{#if data.featureEnabled}
					<div class="flex flex-wrap gap-4 md:items-end md:gap-6">
						<div>
							<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Status</span>
							<Toggle
								checked={enabled}
								label={enabled ? 'Enabled' : 'Disabled'}
								color={enabled ? 'green' : 'red'}
								on:change={(event) => (enabled = event.detail)}
							/>
						</div>

						<div data-onboarding="drift-schedule">
							<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">
								Schedule
							</span>
							<CronInput
								bind:value={cron}
								disabled={saving || !enabled}
								minIntervalMinutes={10}
								onWarning={(msg) => alertStore.add('warning', msg)}
							/>
						</div>

						{#if data.status.lastCheckedAt}
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
										>{formatSmartDateTime(data.status.lastCheckedAt, $serverTimezone)}</span
									>
								</span>
							</div>
						{/if}
					</div>
				{:else}
					<div
						class="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
					>
						Drift detection is not available.
					</div>
				{/if}
			</div>
		</section>

		{#if data.featureEnabled && !enabled}
			<div
				class="rounded border border-neutral-200 bg-neutral-50 p-3 text-sm text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950 dark:text-neutral-400"
			>
				Drift detection is disabled.
			</div>
		{:else if data.featureEnabled}
			<section>
				<h2
					class="mb-3 flex items-center gap-2 text-lg font-semibold text-neutral-900 dark:text-neutral-100"
				>
					<ArrowLeftRight size={18} class="text-neutral-500 dark:text-neutral-400" />
					Latest Result
				</h2>
				<DriftDetection status={data.status} {nextRunAt} />
			</section>
		{/if}
	</div>

	<form
		id="drift-save-form"
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
	</form>
	<form
		id="drift-run-form"
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
	></form>

	<DirtyModal />
{/key}
