<script lang="ts">
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import {
		Download,
		Trash2,
		RotateCcw,
		Upload,
		FolderArchive,
		BrushCleaning
	} from '@lucide/svelte';
	import Modal from '$ui/modal/Modal.svelte';
	import type { PageData } from './$types';
	import Button from '$ui/button/Button.svelte';
	import Table from '$ui/table/Table.svelte';
	import PageMeta from '$ui/meta/PageMeta.svelte';
	import type { Column } from '$ui/table/types';
	import ActionsBar from '$lib/client/ui/actions/ActionsBar.svelte';
	import ActionButton from '$lib/client/ui/actions/ActionButton.svelte';
	import SearchAction from '$lib/client/ui/actions/SearchAction.svelte';
	import Tooltip from '$ui/tooltip/Tooltip.svelte';
	import { getPersistentSearchStore } from '$lib/client/stores/search';
	import { jobStatus } from '$lib/client/stores/jobStatus';
	import { onMount } from 'svelte';
	import { formatDateTime } from '$shared/utils/dates';
	import { dateFormat } from '$lib/client/stores/dateFormat';
	import { serverTimezone } from '$lib/client/stores/timezone';

	export let data: PageData;

	type Backup = (typeof data.backups)[0];

	// Search store
	const searchStore = getPersistentSearchStore('settingsBackupsSearch');

	// Filtered backups
	$: filteredBackups = searchStore.filterItems(data.backups, ['filename']);

	const columns: Column<Backup>[] = [
		{ key: 'created', header: 'Date', sortable: true },
		{ key: 'filename', header: 'Filename', sortable: true },
		{ key: 'sizeFormatted', header: 'Size', sortable: true, width: 'w-28' }
	];

	// Modal state
	let showDeleteModal = false;
	let showRestoreModal = false;
	let showDownloadModal = false;
	let selectedBackup: string | null = null;
	let restoreFormRef: HTMLFormElement | null = null;

	// File upload
	let fileInput: HTMLInputElement;
	let cleanupFormRef: HTMLFormElement;

	function openDownloadModal(filename: string) {
		selectedBackup = filename;
		showDownloadModal = true;
	}

	function confirmDownload() {
		if (selectedBackup) {
			window.location.href = `/api/v1/backups/${selectedBackup}`;
		}
		showDownloadModal = false;
		selectedBackup = null;
	}

	function cancelDownload() {
		showDownloadModal = false;
		selectedBackup = null;
	}

	function triggerFileUpload() {
		fileInput?.click();
	}

	async function handleFileSelected(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (!file) return;

		const formData = new FormData();
		formData.append('file', file);

		try {
			const res = await fetch('/api/v1/backups/upload', {
				method: 'POST',
				body: formData
			});

			if (res.ok) {
				alertStore.add('success', 'Backup uploaded successfully');
				await invalidateAll();
			} else {
				const body = await res.json();
				alertStore.add('error', body.error || 'Failed to upload backup');
			}
		} catch {
			alertStore.add('error', 'Failed to upload backup');
		}

		input.value = '';
	}

	async function triggerCreateBackup() {
		jobStatus.connect();
		try {
			const res = await fetch('/api/v1/backups', { method: 'POST' });

			if (res.ok) {
				alertStore.add('success', 'Backup queued');
			} else {
				const body = await res.json();
				alertStore.add('error', body.error || 'Failed to create backup');
			}
		} catch {
			alertStore.add('error', 'Failed to create backup');
		}
	}

	function triggerCleanupBackups() {
		jobStatus.connect();
		cleanupFormRef?.requestSubmit();
	}

	// Refresh the backups list once a backup job completes, so the new file
	// (or the cleanup result) appears without the user needing to reload.
	onMount(() => {
		let prevState: string | null = null;
		return jobStatus.subscribe((status) => {
			if (
				prevState === 'running' &&
				status.state === 'completed' &&
				status.jobType.startsWith('backup.')
			) {
				invalidateAll();
			}
			prevState = status.state;
		});
	});

	function openDeleteModal(filename: string) {
		selectedBackup = filename;
		showDeleteModal = true;
	}

	function openRestoreModal(filename: string, formRef: HTMLFormElement) {
		selectedBackup = filename;
		restoreFormRef = formRef;
		showRestoreModal = true;
	}

	async function confirmDelete() {
		if (!selectedBackup) return;

		try {
			const res = await fetch(`/api/v1/backups/${selectedBackup}`, { method: 'DELETE' });

			if (res.ok) {
				alertStore.add('success', 'Backup deleted successfully');
				await invalidateAll();
			} else {
				const body = await res.json();
				alertStore.add('error', body.error || 'Failed to delete backup');
			}
		} catch {
			alertStore.add('error', 'Failed to delete backup');
		}

		showDeleteModal = false;
		selectedBackup = null;
	}

	function confirmRestore() {
		if (restoreFormRef) {
			restoreFormRef.requestSubmit();
		}
		showRestoreModal = false;
		selectedBackup = null;
		restoreFormRef = null;
	}

	function cancelDelete() {
		showDeleteModal = false;
		selectedBackup = null;
	}

	function cancelRestore() {
		showRestoreModal = false;
		selectedBackup = null;
		restoreFormRef = null;
	}
</script>

<PageMeta title="Backups" />

<div class="p-4 md:p-8">
	<!-- Header -->
	<div class="mb-8">
		<h1 class="text-2xl font-bold text-neutral-900 md:text-3xl dark:text-neutral-50">Backups</h1>
		<p class="mt-3 text-base text-neutral-600 md:text-lg dark:text-neutral-400">
			Manage database and configuration backups
		</p>
	</div>

	<!-- Hidden file input for upload -->
	<!-- lint-disable-next-line no-raw-ui -- type="file" is not supported by FormInput -->
	<input
		type="file"
		accept=".tar.gz"
		bind:this={fileInput}
		class="hidden"
		on:change={handleFileSelected}
	/>

	<!-- Hidden form for cleanup (stays as form action) -->
	<form
		bind:this={cleanupFormRef}
		method="POST"
		action="?/cleanupBackups"
		class="hidden"
		use:enhance={() => {
			return async ({ result, update }) => {
				if (result.type === 'failure' && result.data) {
					alertStore.add(
						'error',
						(result.data as { error?: string }).error || 'Failed to run backup cleanup'
					);
				} else if (result.type === 'success') {
					alertStore.add('success', 'Backup cleanup queued');
				}
				await update();
			};
		}}
	></form>

	<!-- Actions Bar -->
	<div class="mb-4" data-onboarding="backups-actions">
		<ActionsBar>
			<SearchAction {searchStore} placeholder="Search backups..." />
			<Tooltip text="Upload Backup">
				<ActionButton icon={Upload} on:click={triggerFileUpload} />
			</Tooltip>
			<Tooltip text="Create Backup">
				<ActionButton icon={FolderArchive} on:click={triggerCreateBackup} />
			</Tooltip>
			<Tooltip text="Cleanup">
				<ActionButton icon={BrushCleaning} on:click={triggerCleanupBackups} />
			</Tooltip>
		</ActionsBar>
	</div>

	<!-- Backups Table -->
	<div data-onboarding="backups-table">
		<Table
			{columns}
			data={filteredBackups}
			emptyMessage="No backups found. Create your first backup to get started."
			actionsHeaderAlign="center"
			compact
			responsive
		>
			<svelte:fragment slot="cell" let:row let:column>
				{#if column.key === 'created'}
					<span class="font-medium"
						>{formatDateTime(row.created, $serverTimezone, $dateFormat)}</span
					>
				{:else if column.key === 'filename'}
					<span class="font-mono text-neutral-500 dark:text-neutral-400">{row.filename}</span>
				{:else if column.key === 'sizeFormatted'}
					<span class="text-neutral-500 dark:text-neutral-400">{row.sizeFormatted}</span>
				{/if}
			</svelte:fragment>

			<svelte:fragment slot="actions" let:row>
				<div class="flex items-center justify-center gap-1">
					<Button
						icon={Download}
						size="xs"
						tooltip="Download"
						on:click={() => openDownloadModal(row.filename)}
					/>

					<form
						method="POST"
						action="?/restoreBackup"
						use:enhance={() => {
							return async ({ result, update }) => {
								if (result.type === 'failure' && result.data) {
									alertStore.add(
										'error',
										(result.data as { error?: string }).error || 'Failed to stage restore'
									);
								} else if (result.type === 'success') {
									const message =
										(result.data as { message?: string } | undefined)?.message ||
										'Backup staged. Restart Profilarr to apply.';
									alertStore.add('success', message);
								}
								await update();
							};
						}}
					>
						<input type="hidden" name="filename" value={row.filename} />
						<Button
							icon={RotateCcw}
							size="xs"
							tooltip="Restore"
							on:click={(e) => {
								const form = (e.currentTarget as HTMLElement)?.closest('form');
								if (form) openRestoreModal(row.filename, form);
							}}
						/>
					</form>

					<Button
						icon={Trash2}
						size="xs"
						iconColor="text-red-600 dark:text-red-400"
						tooltip="Delete"
						on:click={() => openDeleteModal(row.filename)}
					/>
				</div>
			</svelte:fragment>
		</Table>
	</div>
</div>

<!-- Delete Confirmation Modal -->
<Modal
	open={showDeleteModal}
	header="Delete Backup"
	bodyMessage="Are you sure you want to delete this backup? This action cannot be undone.{selectedBackup
		? `\n\nBackup: ${selectedBackup}`
		: ''}"
	confirmText="Delete Backup"
	cancelText="Cancel"
	confirmDanger={true}
	on:confirm={confirmDelete}
	on:cancel={cancelDelete}
/>

<!-- Restore Confirmation Modal -->
<Modal
	open={showRestoreModal}
	header="Restore Backup"
	bodyMessage="This will stage the backup to be applied on the next restart. When Profilarr restarts, all current data will be replaced with the contents of this backup. The replacement cannot be undone after restart.{selectedBackup
		? `\n\nBackup: ${selectedBackup}`
		: ''}"
	confirmText="Restore Backup"
	cancelText="Cancel"
	on:confirm={confirmRestore}
	on:cancel={cancelRestore}
/>

<!-- Download Confirmation Modal -->
<Modal
	open={showDownloadModal}
	header="Download Backup"
	confirmText="Download"
	cancelText="Cancel"
	on:confirm={confirmDownload}
	on:cancel={cancelDownload}
>
	<div slot="body" class="space-y-3 text-sm text-neutral-600 dark:text-neutral-400">
		<p>
			The local copy on this server includes everything needed for restore, including secrets. The
			downloaded file is sanitized so it's safer to share. The following will be removed before
			download:
		</p>
		<ul class="list-disc space-y-1 pl-5">
			{#each data.sanitizedCategories as category}
				<li>{category}</li>
			{/each}
		</ul>
		<p>
			Restoring the downloaded file on a different host will require re-adding the removed items.
			Linked databases (PCD repos), AI/TMDB settings rows, and your backup schedule are preserved
			(with their secret values blanked).
		</p>
		{#if selectedBackup}
			<p class="font-mono text-xs">Backup: {selectedBackup}</p>
		{/if}
	</div>
</Modal>
