<script lang="ts">
	import Button from '$ui/button/Button.svelte';
	import CronInput from '$ui/cron/CronInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import { RefreshCw, Save, Loader2, AlertTriangle } from 'lucide-svelte';
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

<div class="border-t border-border px-4 py-4 md:px-6">
	<div class="flex flex-col gap-3">
		{#if warning}
			<div class="flex items-center gap-1.5 text-xs text-warning-icon sm:hidden">
				<AlertTriangle size={14} class="flex-shrink-0" />
				<span>{warning}</span>
			</div>
		{/if}

		<!-- Row 1: Trigger + Warning + Buttons -->
		<div class="flex items-center justify-between gap-2">
			<div data-onboarding={onboardingId}>
				<span class="mb-1 block text-xs text-text-muted">Trigger</span>
				<DropdownSelect
					value={syncTrigger}
					options={triggerOptions}
					buttonSize="sm"
					width="w-28"
					justify="center"
					on:change={(e) => (syncTrigger = e.detail as typeof syncTrigger)}
				/>
			</div>

			<div>
				<span class="mb-1 block text-xs text-transparent select-none">&nbsp;</span>
				<div class="flex items-center gap-3">
					{#if warning}
						<div class="hidden items-center gap-1.5 text-xs text-warning-icon sm:flex">
							<AlertTriangle size={14} class="flex-shrink-0" />
							<span>{warning}</span>
						</div>
					{/if}
					<Button
						text="Sync"
						variant="secondary"
						disabled={syncDisabled}
						icon={syncing ? Loader2 : RefreshCw}
						iconColor={syncing ? 'text-info-icon animate-spin' : 'text-info-icon '}
						title={isDirty ? 'Save changes before syncing' : ''}
						on:click={() => dispatch('sync')}
					/>
					<Button
						text="Save"
						variant="secondary"
						disabled={saveDisabled}
						icon={saving ? Loader2 : Save}
						iconColor={saving ? 'text-success-icon animate-spin' : 'text-success-icon '}
						on:click={() => dispatch('save')}
					/>
				</div>
			</div>
		</div>

		<!-- Row 2: Cron (only when schedule) -->
		{#if syncTrigger === 'schedule'}
			<div class="border-t border-border pt-3">
				<span class="mb-1 block text-xs text-text-muted">Schedule</span>
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
