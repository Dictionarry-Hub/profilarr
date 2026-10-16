<script lang="ts">
	import Button from '$ui/button/Button.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import RefreshCw from '@lucide/svelte/icons/refresh-cw';
	import Save from '@lucide/svelte/icons/save';
	import Loader2 from '@lucide/svelte/icons/loader-circle';
	import AlertTriangle from '@lucide/svelte/icons/triangle-alert';
	import { createEventDispatcher } from 'svelte';

	export let syncTrigger: 'manual' | 'on_pull' | 'schedule' = 'manual';
	export let cronExpression: string = '0 * * * *';
	export let saving: boolean = false;
	export let syncing: boolean = false;
	export let isDirty: boolean = false;
	export let canSave: boolean = true;
	export let hasConfig: boolean = true;
	export let warning: string | null = null;
	export let onWarning: ((message: string) => void) | undefined = undefined;
	export let onboardingId: string | undefined = undefined;

	const dispatch = createEventDispatcher<{ save: void; sync: void }>();

	const triggerOptions = [
		{ value: 'manual', label: 'Manual' },
		{ value: 'on_pull', label: 'On Pull' },
		{ value: 'schedule', label: 'Schedule' }
	];

	// Save disabled when not dirty or can't save, Sync disabled when dirty (unsaved changes) or nothing configured
	$: saveDisabled = saving || !isDirty || !canSave;
	$: syncDisabled = syncing || isDirty || !hasConfig;
</script>

<div class="border-t border-neutral-200 px-4 py-4 md:px-6 dark:border-neutral-800">
	<div class="flex flex-col gap-3">
		{#if warning}
			<div class="flex items-center gap-1.5 text-xs text-amber-600 sm:hidden dark:text-amber-400">
				<AlertTriangle size={14} class="flex-shrink-0" />
				<span>{warning}</span>
			</div>
		{/if}

		<!-- Row 1: Trigger (+ section controls) + Warning + Buttons -->
		<div class="flex items-center justify-between gap-2">
			<div class="flex items-end gap-2">
				<div data-onboarding={onboardingId}>
					<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Trigger</span>
					<DropdownSelect
						value={syncTrigger}
						options={triggerOptions}
						buttonSize="sm"
						justify="center"
						on:change={(e) => (syncTrigger = e.detail as typeof syncTrigger)}
					/>
				</div>
				<!-- Section-specific controls that sit beside the trigger -->
				<slot name="controls" />
			</div>

			<div>
				<span class="mb-1 block text-xs text-transparent select-none">&nbsp;</span>
				<div class="flex items-center gap-3">
					{#if warning}
						<div
							class="hidden items-center gap-1.5 text-xs text-amber-600 sm:flex dark:text-amber-400"
						>
							<AlertTriangle size={14} class="flex-shrink-0" />
							<span>{warning}</span>
						</div>
					{/if}
					<Button
						text="Sync"
						variant="secondary"
						disabled={syncDisabled}
						icon={syncing ? Loader2 : RefreshCw}
						iconColor={syncing
							? 'text-blue-600 dark:text-blue-400 animate-spin'
							: 'text-blue-600 dark:text-blue-400'}
						title={isDirty ? 'Save changes before syncing' : ''}
						on:click={() => dispatch('sync')}
					/>
					<Button
						text="Save"
						variant="secondary"
						disabled={saveDisabled}
						icon={saving ? Loader2 : Save}
						iconColor={saving
							? 'text-green-600 dark:text-green-400 animate-spin'
							: 'text-green-600 dark:text-green-400'}
						on:click={() => dispatch('save')}
					/>
				</div>
			</div>
		</div>

		<!-- Row 2: Cron (only when schedule) -->
		{#if syncTrigger === 'schedule'}
			<div class="border-t border-neutral-200 pt-3 dark:border-neutral-800">
				<span class="mb-1 block text-xs text-neutral-500 dark:text-neutral-400">Schedule</span>
				<CronInput
					bind:value={cronExpression}
					disabled={saving}
					minIntervalMinutes={10}
					{onWarning}
				/>
			</div>
		{/if}
	</div>
</div>
