<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import type { ActionData, PageData } from './$types';
	import { onDestroy, onMount } from 'svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import { initEdit, update as updateDirty, clear, isDirty } from '$lib/client/stores/dirty';
	import { jobStatus } from '$stores/jobStatus';
	import { formatSmartDateTime } from '$shared/utils/dates';
	import { dateFormat } from '$lib/client/stores/dateFormat';
	import { serverTimezone } from '$lib/client/stores/timezone';
	import Button from '$ui/button/Button.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import DirtyModal from '$ui/modal/DirtyModal.svelte';
	import Label from '$ui/label/Label.svelte';
	import ExpandableTable from '$ui/table/ExpandableTable.svelte';
	import Toggle from '$ui/toggle/Toggle.svelte';
	import type { Column } from '$ui/table/types';
	import { Loader2, Play, Save } from 'lucide-svelte';
	import type { DriftDisplayEntity, DriftDisplayTone } from '$shared/drift.ts';
	import DriftFieldDiffTable from './components/DriftFieldDiffTable.svelte';

	export let data: PageData;
	export let form: ActionData;

	type LabelVariant = 'default' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';

	const toneToVariant: Record<DriftDisplayTone, LabelVariant> = {
		neutral: 'secondary',
		success: 'success',
		warning: 'warning',
		danger: 'danger',
		info: 'info'
	};

	const driftColumns: Column<DriftDisplayEntity>[] = [
		{ key: 'title', header: 'Name' },
		{ key: 'section', header: 'Entity', width: 'w-56' },
		{ key: 'state', header: 'State', width: 'w-32' }
	];

	const arrTypeLabels: Record<string, string> = {
		radarr: 'Radarr',
		sonarr: 'Sonarr'
	};

	const emptyDriftEntities: DriftDisplayEntity[] = [];

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
		let previousJobState: string | null = null;
		const unsubscribeJobStatus = jobStatus.subscribe((status) => {
			if (
				previousJobState === 'running' &&
				status.state === 'completed' &&
				status.jobType === 'arr.drift'
			) {
				invalidateAll();
			}
			previousJobState = status.state;
		});
		return () => {
			unsubscribeJobStatus();
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
	$: driftArrLabel = `${arrTypeLabels[data.instance.type] ?? data.instance.type} - ${data.instance.name}`;

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
			jobStatus.cancelOptimistic();
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
			<h1 class="text-xl font-semibold text-text">Drift</h1>
			<p class="text-sm text-text-muted">
				Compare synced configuration against the current Arr state.
			</p>
		</div>
		<div slot="right" class="flex items-center gap-2">
			<Button
				text={running ? 'Running...' : 'Run Now'}
				icon={Play}
				iconColor="text-success-icon "
				disabled={saving || running || $isDirty || !data.featureEnabled || !enabled}
				on:click={() => {
					jobStatus.connect();
					jobStatus.setRunning('arr.drift', 'Checking drift...');
					const runForm = document.getElementById('drift-run-form');
					if (runForm instanceof HTMLFormElement) {
						runForm.requestSubmit();
					} else {
						jobStatus.cancelOptimistic();
					}
				}}
			/>
			<Button
				text={saving ? 'Saving...' : 'Save'}
				icon={saving ? Loader2 : Save}
				iconColor={saving ? 'text-info-icon animate-spin' : 'text-info-icon '}
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

	<div class="mt-4 space-y-6 pb-32">
		<section class="border-b border-border pb-5">
			{#if data.featureEnabled}
				<div class="flex flex-wrap gap-4 md:items-end md:gap-x-5 md:gap-y-3 md:px-4">
					<div>
						<span
							class="mb-1 block text-[10px] font-medium tracking-wider text-text-subtle uppercase"
						>
							Detection
						</span>
						<Toggle
							checked={enabled}
							label={enabled ? 'Enabled' : 'Disabled'}
							color={enabled ? 'green' : 'red'}
							on:change={(event) => (enabled = event.detail)}
						/>
					</div>
					<div data-onboarding="drift-schedule">
						<span
							class="mb-1 block text-[10px] font-medium tracking-wider text-text-subtle uppercase"
						>
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
							class="flex w-full flex-wrap items-center gap-1.5 border-t border-border pt-3 md:ml-auto md:w-auto md:border-0 md:pt-0"
						>
							{#if !enabled}
								<Label variant="warning" size="md" radius="md">Paused</Label>
							{:else if timeUntilNext !== null && timeUntilNext <= 0}
								<Label variant="success" size="md" radius="md">Ready</Label>
							{:else if timeUntilNext !== null}
								<Label variant="secondary" size="md" radius="md" mono>
									Next {formatTimeRemaining(timeUntilNext)}
								</Label>
							{/if}
							<Label variant="secondary" size="md" radius="md" mono>
								Last {formatSmartDateTime(data.status.lastCheckedAt, $serverTimezone, $dateFormat)}
							</Label>
						</div>
					{/if}
				</div>
			{:else}
				<div class="text-sm text-text-muted md:px-4">Drift detection is not available.</div>
			{/if}
		</section>

		{#if data.featureEnabled}
			<section class="md:px-4">
				{#if !enabled}
					<ExpandableTable
						columns={driftColumns}
						data={emptyDriftEntities}
						getRowId={(row) => row.id}
						responsive
						chevronPosition="right"
						primaryColumnKey="title"
						flushExpanded
						emptyMessage="Drift detection is disabled. Toggle it on above to start checking."
					/>
				{:else if data.status.status === 'failed' && data.status.lastError}
					<div
						class="rounded-card border border-danger-border bg-danger-bg p-4 text-sm text-danger-text"
					>
						{data.status.lastError}
					</div>
				{:else if data.status.status === 'never_checked'}
					<ExpandableTable
						columns={driftColumns}
						data={emptyDriftEntities}
						getRowId={(row) => row.id}
						responsive
						chevronPosition="right"
						primaryColumnKey="title"
						flushExpanded
						emptyMessage="No drift check has run yet. Hit Run Now above to check."
					/>
				{:else if data.status.status === 'clean'}
					<ExpandableTable
						columns={driftColumns}
						data={emptyDriftEntities}
						getRowId={(row) => row.id}
						responsive
						chevronPosition="right"
						primaryColumnKey="title"
						flushExpanded
						emptyMessage="✅ All synced up. Move along, nothing to see here."
					/>
				{:else if data.driftEntities.length > 0}
					<ExpandableTable
						columns={driftColumns}
						data={data.driftEntities}
						getRowId={(row) => row.id}
						responsive
						chevronPosition="right"
						primaryColumnKey="title"
						flushExpanded
					>
						<svelte:fragment slot="cell" let:row let:column>
							{#if column.key === 'title'}
								<div class="flex flex-col gap-1">
									<span class="text-sm font-medium text-text">
										{row.title}
									</span>
									{#if row.summary}
										<span class="text-xs text-text-muted">
											{row.summary}
										</span>
									{/if}
								</div>
							{:else if column.key === 'section'}
								<Label variant="secondary" size="md" radius="md">{row.sectionLabel}</Label>
							{:else if column.key === 'state'}
								<Label variant={toneToVariant[row.tone]} size="md" radius="md">
									{row.stateLabel}
								</Label>
							{/if}
						</svelte:fragment>

						<svelte:fragment slot="expanded" let:row>
							<div class="px-4 py-3 md:px-6 md:py-4">
								<DriftFieldDiffTable changes={row.changes} arrLabel={driftArrLabel} />
							</div>
						</svelte:fragment>
					</ExpandableTable>
				{:else}
					<ExpandableTable
						columns={driftColumns}
						data={emptyDriftEntities}
						getRowId={(row) => row.id}
						responsive
						chevronPosition="right"
						primaryColumnKey="title"
						flushExpanded
						emptyMessage="Drift was detected, but no displayable items were stored."
					/>
				{/if}
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
