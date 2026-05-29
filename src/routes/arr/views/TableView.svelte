<script lang="ts">
	import { ExternalLink, Unlink } from 'lucide-svelte';
	import Table from '$ui/table/Table.svelte';
	import Button from '$ui/button/Button.svelte';
	import Label from '$ui/label/Label.svelte';
	import { getDisplayUrl } from '$lib/client/utils/arrDisplayUrl.ts';
	import type { Column } from '$ui/table/types';
	import type { ArrInstanceSummary } from '../+page.server.ts';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';
	import { createEventDispatcher } from 'svelte';

	export let instances: ArrInstanceSummary[];

	const dispatch = createEventDispatcher<{
		delete: ArrInstanceSummary;
	}>();

	const logos: Record<string, string> = {
		radarr: radarrLogo,
		sonarr: sonarrLogo
	};

	let loadedImages: Set<number> = new Set();

	function getLogoPath(type: string): string {
		return logos[type] || '';
	}

	function handleImageLoad(id: number) {
		loadedImages.add(id);
		loadedImages = loadedImages;
	}

	function checkLoaded(node: HTMLImageElement, id: number) {
		if (node.complete) handleImageLoad(id);
	}

	function formatType(type: string): string {
		return type.charAt(0).toUpperCase() + type.slice(1);
	}

	function getRowHref(instance: ArrInstanceSummary): string {
		return `/arr/${instance.id}`;
	}

	function handleDeleteClick(e: Event, instance: ArrInstanceSummary) {
		e.stopPropagation();
		e.preventDefault();
		dispatch('delete', instance);
	}

	const columns: Column<ArrInstanceSummary>[] = [
		{ key: 'name', header: 'Name', align: 'left' },
		{ key: 'qualityProfiles', header: 'Quality Profiles', align: 'left' },
		{ key: 'delayProfile', header: 'Delay Profile', align: 'left' },
		{ key: 'mediaManagement', header: 'Media Management', align: 'left' },
		{ key: 'upgrades', header: 'Upgrades', align: 'center', width: 'w-24' },
		{ key: 'renames', header: 'Renames', align: 'center', width: 'w-24' },
		{ key: 'cleanup', header: 'Cleanup', align: 'center', width: 'w-24' }
	];
</script>

<Table {columns} data={instances} hoverable={true} rowHref={getRowHref}>
	<svelte:fragment slot="cell" let:row let:column>
		{#if column.key === 'name'}
			<div class="flex items-center gap-3">
				<div class="relative h-6 w-6 flex-shrink-0">
					{#if !loadedImages.has(row.id)}
						<div class="absolute inset-0 animate-pulse rounded bg-surface-hover"></div>
					{/if}
					<img
						src={getLogoPath(row.type)}
						alt={`${formatType(row.type)} logo`}
						class="h-6 w-6 rounded {loadedImages.has(row.id) ? 'opacity-100' : 'opacity-0'}"
						on:load={() => handleImageLoad(row.id)}
						use:checkLoaded={row.id}
					/>
				</div>
				<span class="font-medium text-text">{row.name}</span>
			</div>
		{:else if column.key === 'qualityProfiles'}
			{#if row.syncedProfileNames.length > 0}
				<div class="flex flex-wrap gap-1">
					{#each row.syncedProfileNames as name}
						<Label variant="secondary" size="sm" rounded="md">{name}</Label>
					{/each}
				</div>
			{:else}
				<span class="text-xs text-text-muted">None</span>
			{/if}
		{:else if column.key === 'delayProfile'}
			{#if row.delayProfileName}
				<Label variant="secondary" size="sm" rounded="md">{row.delayProfileName}</Label>
			{:else}
				<span class="text-xs text-text-muted">None</span>
			{/if}
		{:else if column.key === 'mediaManagement'}
			{#if row.namingConfigName || row.qualityDefinitionsConfigName || row.mediaSettingsConfigName}
				<div class="flex flex-wrap gap-1">
					{#if row.namingConfigName}
						<Label variant="secondary" size="sm" rounded="md">Naming: {row.namingConfigName}</Label>
					{/if}
					{#if row.qualityDefinitionsConfigName}
						<Label variant="secondary" size="sm" rounded="md"
							>Quality Definitions: {row.qualityDefinitionsConfigName}</Label
						>
					{/if}
					{#if row.mediaSettingsConfigName}
						<Label variant="secondary" size="sm" rounded="md"
							>Media Settings: {row.mediaSettingsConfigName}</Label
						>
					{/if}
				</div>
			{:else}
				<span class="text-xs text-text-muted">None</span>
			{/if}
		{:else if column.key === 'upgrades'}
			<div class="flex justify-center">
				<Label variant={row.upgradeEnabled ? 'success' : 'secondary'} size="sm" rounded="md"
					>{row.upgradeEnabled ? 'On' : 'Off'}</Label
				>
			</div>
		{:else if column.key === 'renames'}
			<div class="flex justify-center">
				<Label variant={row.renameEnabled ? 'success' : 'secondary'} size="sm" rounded="md"
					>{row.renameEnabled ? 'On' : 'Off'}</Label
				>
			</div>
		{:else if column.key === 'cleanup'}
			<div class="flex justify-center">
				<Label variant={row.cleanupEnabled ? 'success' : 'secondary'} size="sm" rounded="md"
					>{row.cleanupEnabled ? 'On' : 'Off'}</Label
				>
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
				href={getDisplayUrl(row)}
				target="_blank"
				rel="noopener noreferrer"
			/>
			<Button
				icon={Unlink}
				size="xs"
				title="Unlink instance"
				variant="secondary"
				iconColor="text-danger-solid"
				on:click={(e) => handleDeleteClick(e, row)}
			/>
		</div>
	</svelte:fragment>
</Table>
