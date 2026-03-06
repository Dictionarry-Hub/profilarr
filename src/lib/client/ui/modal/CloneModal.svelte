<script lang="ts">
	import { invalidateAll } from '$app/navigation';
	import { alertStore } from '$alerts/store';
	import Modal from './Modal.svelte';
	import FormInput from '$ui/form/FormInput.svelte';
	import type { EntityType } from '$shared/pcd/portable.ts';

	export let open = false;
	export let databaseId: number;
	export let entityType: EntityType;
	export let sourceName: string = '';
	export let existingNames: string[] = [];
	export let canWriteToBase: boolean = false;

	let newName = '';
	let loading = false;

	// Pre-populate name when modal opens
	$: if (open && sourceName) {
		newName = `${sourceName} (Copy)`;
	}

	$: layer = canWriteToBase ? 'base' : 'user';

	$: nameConflict = existingNames.some((n) => n.toLowerCase() === newName.trim().toLowerCase());
	$: confirmDisabled = !newName.trim() || nameConflict || loading;

	async function handleConfirm() {
		if (confirmDisabled) return;

		loading = true;
		try {
			// Export the source entity
			const params = new URLSearchParams({
				databaseId: String(databaseId),
				entityType,
				name: sourceName
			});
			const exportRes = await fetch(`/api/v1/pcd/export?${params}`);
			const exportJson = await exportRes.json();
			if (!exportRes.ok) {
				alertStore.add('error', exportJson.error || 'Export failed');
				return;
			}

			// Rename and import
			exportJson.data.name = newName.trim();
			const importRes = await fetch('/api/v1/pcd/import', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					databaseId,
					layer,
					entityType,
					data: exportJson.data
				})
			});
			const importJson = await importRes.json();
			if (!importRes.ok) {
				alertStore.add('error', importJson.error || 'Clone failed');
				return;
			}

			open = false;
			alertStore.add('success', `Cloned as "${newName.trim()}"`);
			await invalidateAll();
		} catch {
			alertStore.add('error', 'Clone failed');
		} finally {
			loading = false;
		}
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
					An entity with this name already exists.
				</p>
			{/if}
		</div>
	</div>
</Modal>
