<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import Modal from './Modal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import DropdownSelect from '$ui/dropdown/DropdownSelect.svelte';
	import type { EntityType } from '$shared/pcd/portable.ts';

	interface DatabaseOption {
		id: number;
		name: string;
	}

	export let open = false;
	export let databaseId: number;
	export let entityType: EntityType;
	export let sourceName: string = '';
	export let existingNames: string[] = [];
	export let canWriteToBase: boolean = false;
	export let databases: DatabaseOption[] = [];

	let newName = '';
	let loading = false;
	let targetDatabaseId = databaseId;

	$: if (open) {
		targetDatabaseId = databaseId;
		newName = sourceName ? `${sourceName} (Copy)` : '';
	}

	$: isCrossDatabase = targetDatabaseId !== databaseId;
	$: dbOptions = databases.map((d) => ({ value: String(d.id), label: d.name }));

	$: nameConflict =
		!isCrossDatabase && existingNames.some((n) => n.toLowerCase() === newName.trim().toLowerCase());
	$: confirmDisabled = !newName.trim() || nameConflict || loading;

	async function handleConfirm() {
		if (confirmDisabled) return;

		const trimmedName = newName.trim();
		loading = true;
		try {
			if (isCrossDatabase) {
				await handleCrossDatabaseClone(trimmedName);
			} else {
				await handleSameDatabaseClone(trimmedName);
			}
			open = false;
			await invalidateAll();
		} catch (err) {
			alertStore.add('error', err instanceof Error ? err.message : 'Clone failed');
		} finally {
			loading = false;
		}
	}

	async function throwIfNotOk(res: Response, fallback: string): Promise<void> {
		if (!res.ok) {
			const body = await res.json().catch(() => ({}));
			throw new Error((body as { error?: string }).error || fallback);
		}
	}

	async function handleSameDatabaseClone(trimmedName: string) {
		const params = new URLSearchParams({ entityType, name: sourceName });
		const exportRes = await fetch(`/databases/${databaseId}/export?${params}`);
		await throwIfNotOk(exportRes, 'Export failed');
		const exportJson = await exportRes.json();

		exportJson.data.name = trimmedName;
		const importRes = await fetch(`/databases/${databaseId}/import`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				layer: canWriteToBase ? 'base' : 'user',
				entityType,
				data: exportJson.data
			})
		});
		await throwIfNotOk(importRes, 'Clone failed');

		alertStore.add('success', `Cloned as "${trimmedName}"`);
	}

	async function handleCrossDatabaseClone(trimmedName: string) {
		const res = await fetch(`/databases/${databaseId}/clone-to/${targetDatabaseId}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ entityType, name: sourceName, newName: trimmedName })
		});
		await throwIfNotOk(res, 'Clone failed');

		const targetDbName = databases.find((d) => d.id === targetDatabaseId)?.name ?? 'target';
		alertStore.add('success', `Cloned "${sourceName}" to "${targetDbName}" as "${trimmedName}"`);
	}

	function handleCancel() {
		open = false;
	}
</script>

<Modal
	{open}
	header="Clone"
	confirmText="Clone"
	{loading}
	{confirmDisabled}
	on:confirm={handleConfirm}
	on:cancel={handleCancel}
	size="sm"
	bodyOverflow="visible"
>
	<div slot="body">
		<div class="space-y-4">
			<FormInput
				label="New Name"
				bind:value={newName}
				placeholder="Enter a name for the clone"
				required
			/>

			{#if nameConflict}
				<p class="text-xs text-red-600 dark:text-red-400">
					An entity with this name already exists in this database.
				</p>
			{/if}

			{#if databases.length > 1}
				<div class="space-y-2">
					<span class="block text-sm font-medium text-neutral-900 dark:text-neutral-100">
						Target Database
					</span>
					<DropdownSelect
						value={String(targetDatabaseId)}
						options={dbOptions}
						fullWidth
						on:change={(e) => (targetDatabaseId = Number(e.detail))}
					/>
				</div>
			{/if}

			{#if isCrossDatabase}
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					Dependencies will be cloned automatically. If a dependency already exists with different
					content, it's renamed with a numeric suffix (e.g. "(2)"). The entity itself must not
					already exist in the target database.
				</p>
			{/if}
		</div>
	</div>
</Modal>
