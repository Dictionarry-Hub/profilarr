<script lang="ts">
	import { ExternalLink, Unlink } from 'lucide-svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import type { Column } from '$ui/table/types';
	import type { ArrInstancePublic } from '$db/queries/arrInstances.ts';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';
	import { createEventDispatcher } from 'svelte';

	export let instances: ArrInstancePublic[];

	const dispatch = createEventDispatcher<{
		delete: ArrInstancePublic;
	}>();

	// Logo lookup by type
	const logos: Record<string, string> = {
		radarr: radarrLogo,
		sonarr: sonarrLogo
	};

	// Track loaded images
	let loadedImages: Set<number> = new Set();

	// Get logo path based on arr type
	function getLogoPath(type: string): string {
		return logos[type] || '';
	}

	function handleImageLoad(id: number) {
		loadedImages.add(id);
		loadedImages = loadedImages;
	}

	// Format type for display with proper casing
	function formatType(type: string): string {
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function getRowHref(instance: ArrInstancePublic): string {
		return `/arr/${instance.id}`;
	}

	// Handle delete click
	function handleDeleteClick(e: Event, instance: ArrInstancePublic) {
		e.stopPropagation();
		e.preventDefault();
		dispatch('delete', instance);
	}

	// Define table columns
	const columns: Column<ArrInstancePublic>[] = [
		{ key: 'name', header: 'Name', align: 'left' },
		{ key: 'url', header: 'URL', align: 'left' },
		{ key: 'enabled', header: 'Enabled', align: 'center', width: 'w-24' }
	];
</script>

<Table {columns} data={instances} hoverable={true} rowHref={getRowHref}>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<div class="flex items-center gap-3">
				<div class="relative h-8 w-8">
					{#if !loadedImages.has(row.id)}
						<div
							class="absolute inset-0 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"
						></div>
					{/if}
					<img
						src={getLogoPath(row.type)}
						alt={`${formatType(row.type)} logo`}
						class="h-8 w-8 rounded-lg {loadedImages.has(row.id) ? 'opacity-100' : 'opacity-0'}"
						on:load={() => handleImageLoad(row.id)}
					/>
				</div>
				<div class="flex items-center gap-2">
					<div class="font-medium text-neutral-900 dark:text-neutral-50">
						{row.name}
					</div>
				</div>
			</div>
		{:else if column.key === 'url'}
			<Label variant="secondary" size="sm" rounded="md" mono>{row.url}</Label>
		{:else if column.key === 'enabled'}
			<div class="flex justify-center">
				{#if row.enabled}
					<Label variant="success" size="sm" rounded="md">Enabled</Label>
				{:else}
					<Label variant="secondary" size="sm" rounded="md">Disabled</Label>
				{/if}
			</div>
		{/if}
	</svelte:fragment>

	<svelte:fragment slot="actions" let:row>
		<div class="relative z-10 flex items-center justify-end gap-1">
			<Button
				icon={ExternalLink}
				size="xs"
				variant="secondary"
				title={`Open in ${formatType(row.type)}`}
				ariaLabel={`Open in ${formatType(row.type)}`}
				href={row.url}
				target="_blank"
				rel="noopener noreferrer"
			/>
			<Button
				icon={Unlink}
				size="xs"
				title="Unlink instance"
				variant="secondary"
				iconColor="text-red-600 dark:text-red-400"
				on:click={(e) => handleDeleteClick(e, row)}
			/>
		</div>
	</svelte:fragment>
</Table>
