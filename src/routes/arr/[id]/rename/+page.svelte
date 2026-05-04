<script lang="ts">
	import type { PageData, ActionData } from './$types';
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { onMount } from 'svelte';
	import { alertStore } from '$lib/client/alerts/store';
	import { isDirty, initEdit, update, current, clear } from '$lib/client/stores/dirty';
	import { jobStatus } from '$stores/jobStatus';
	import { Info, Save, FlaskConical, Play } from 'lucide-svelte';
	import RenameSettings from './components/RenameSettings.svelte';
	import RenameRunHistory from './components/RenameRunHistory.svelte';
	import RenameInfoModal from './components/RenameInfoModal.svelte';
	import DirtyModal from '$lib/client/ui/modal/DirtyModal.svelte';
	import StickyCard from '$ui/card/StickyCard.svelte';
	import Button from '$ui/button/Button.svelte';

	export let data: PageData;
	export let form: ActionData;

	// Initialize dirty tracking on mount (same pattern as sync page)
	onMount(() => {
		const initialFormData = {
			enabled: data.settings?.enabled ?? false,
			renameFolders: data.settings?.renameFolders ?? false,
			ignoreTag: data.settings?.ignoreTag ?? '',
			cron: data.settings?.cron ?? '0 0 * * *',
			summaryNotifications: data.settings?.summaryNotifications ?? true
		};
		// Always use initEdit - isDirty should be false until user makes changes
		initEdit(initialFormData);
		let previousJobState: string | null = null;
		const unsubscribeJobStatus = jobStatus.subscribe((status) => {
			if (
				previousJobState === 'running' &&
				status.state === 'completed' &&
				status.jobType === 'arr.rename'
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

	$: isNewConfig = !data.settings;

	let showInfoModal = false;
	let saving = false;
	let running = false;

	$: enabled = ($current.enabled ?? false) as boolean;
	$: renameFolders = ($current.renameFolders ?? false) as boolean;
	$: ignoreTag = ($current.ignoreTag ?? '') as string;
	$: cron = ($current.cron ?? '0 0 * * *') as string;
	$: summaryNotifications = ($current.summaryNotifications ?? true) as boolean;

	let lastFormId: unknown = null;
	$: if (form && form !== lastFormId) {
		lastFormId = form;
		if (form.success && !form.queued) {
			alertStore.add('success', 'Configuration saved successfully');
			initEdit({ enabled, renameFolders, ignoreTag, cron, summaryNotifications });
		}
		if (form.success && form.queued) {
			alertStore.add('success', 'Rename run queued');
		}
		if (form.error) {
			jobStatus.cancelOptimistic();
			alertStore.add('error', form.error);
		}
	}
</script>

<svelte:head>
	<title>{data.instance.name} - Rename - Profilarr</title>
</svelte:head>

{#key data.instance.id}
	<StickyCard position="top">
		<div slot="left">
			<h1 class="text-xl font-semibold text-neutral-900 dark:text-neutral-50">Rename</h1>
			<p class="text-sm text-neutral-500 dark:text-neutral-400">
				Automatically rename files and folders to match your naming format.
			</p>
		</div>
		<div slot="right" class="flex items-center gap-2">
			<Button text="How it works" icon={Info} on:click={() => (showInfoModal = true)} />
			<Button
				text={running ? 'Running...' : 'Dry Run'}
				icon={FlaskConical}
				iconColor="text-amber-600 dark:text-amber-400"
				disabled={isNewConfig || !enabled || running || saving || $isDirty}
				tooltip="Preview which files would be renamed without making changes"
				tooltipPosition="bottom"
				tooltipAlign="right"
				on:click={() => {
					jobStatus.connect();
					jobStatus.setRunning('arr.rename', 'Renaming files...');
					const f = document.getElementById('dry-run-form');
					if (f instanceof HTMLFormElement) {
						f.requestSubmit();
					} else {
						jobStatus.cancelOptimistic();
					}
				}}
			/>
			<Button
				text={running ? 'Running...' : 'Run Now'}
				icon={Play}
				iconColor="text-green-600 dark:text-green-400"
				disabled={isNewConfig || !enabled || running || saving || $isDirty}
				tooltip="Rename files and folders now"
				tooltipPosition="bottom"
				tooltipAlign="right"
				on:click={() => {
					jobStatus.connect();
					jobStatus.setRunning('arr.rename', 'Renaming files...');
					const f = document.getElementById('live-run-form');
					if (f instanceof HTMLFormElement) {
						f.requestSubmit();
					} else {
						jobStatus.cancelOptimistic();
					}
				}}
			/>
			<Button
				text="Save"
				icon={Save}
				iconColor="text-blue-600 dark:text-blue-400"
				disabled={saving || running || !$isDirty}
				on:click={() => {
					const saveForm = document.getElementById('save-form');
					if (saveForm instanceof HTMLFormElement) {
						saveForm.requestSubmit();
					}
				}}
			/>
		</div>
	</StickyCard>

	<div class="mt-4 space-y-6">
		<section class="border-b border-neutral-200 pb-5 dark:border-neutral-800">
			<RenameSettings
				{enabled}
				{renameFolders}
				{ignoreTag}
				{cron}
				{summaryNotifications}
				lastRunAt={data.settings?.lastRunAt ?? null}
				nextRunAt={data.settings?.nextRunAt ?? null}
				onEnabledChange={(v) => update('enabled', v)}
				onRenameFoldersChange={(v) => update('renameFolders', v)}
				onIgnoreTagChange={(v) => update('ignoreTag', v)}
				onCronChange={(v) => update('cron', v)}
				onSummaryNotificationsChange={(v) => update('summaryNotifications', v)}
				onWarning={(msg) => alertStore.add('warning', msg)}
			/>
		</section>

		<section class="md:px-4">
			<RenameRunHistory runs={data.renameRuns} />
		</section>
	</div>

	<!-- Hidden forms -->
	<form
		id="save-form"
		method="POST"
		action={isNewConfig ? '?/save' : '?/update'}
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
		<input type="hidden" name="renameFolders" value={renameFolders} />
		<input type="hidden" name="ignoreTag" value={ignoreTag} />
		<input type="hidden" name="cron" value={cron} />
		<input type="hidden" name="summaryNotifications" value={summaryNotifications} />
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
	{/if}

	<RenameInfoModal bind:open={showInfoModal} />
	<DirtyModal />
{/key}
