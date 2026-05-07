<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Card from '$ui/card/Card.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Copy, Download, Layers } from 'lucide-svelte';
	import type { QualityDefinitionListItem } from '$shared/pcd/display.ts';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';
	import { FEATURES } from '$shared/features.ts';

	export let configs: QualityDefinitionListItem[];
	export let databaseId: number;

	const dispatch = createEventDispatcher<{
		clone: { name: string; arr_type: string };
		export: { name: string; arr_type: string };
	}>();

	const logos: Record<string, string> = {
		radarr: radarrLogo,
		sonarr: sonarrLogo
	};

	let loadedImages: Set<string> = new Set();

	function handleImageLoad(name: string) {
		loadedImages.add(name);
		loadedImages = loadedImages;
	}

	function getConfigHref(config: QualityDefinitionListItem): string {
		return `/media-management/${databaseId}/quality-definitions/${config.arr_type}/${encodeURIComponent(
			config.name
		)}`;
	}
</script>

<CardGrid columns={4} flush>
	{#each configs as config}
		<Card href={getConfigHref(config)} hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<div class="relative h-6 w-6 flex-shrink-0">
							{#if !loadedImages.has(config.name)}
								<div
									class="absolute inset-0 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
								></div>
							{/if}
							<img
								src={logos[config.arr_type]}
								alt="{config.arr_type} logo"
								class="h-6 w-6 rounded {loadedImages.has(config.name)
									? 'opacity-100'
									: 'opacity-0'}"
								on:load={() => handleImageLoad(config.name)}
							/>
						</div>
						<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{config.name}
						</h3>
					</div>
					<div class="flex items-center gap-0.5" on:click|stopPropagation|preventDefault>
						{#if FEATURES.importExport}
							<Button
								icon={Download}
								size="xs"
								variant="ghost"
								tooltip="Export"
								on:click={() =>
									dispatch('export', { name: config.name, arr_type: config.arr_type })}
							/>
						{/if}
						<Button
							icon={Copy}
							size="xs"
							variant="ghost"
							tooltip="Clone"
							on:click={() => dispatch('clone', { name: config.name, arr_type: config.arr_type })}
						/>
					</div>
				</div>
			</svelte:fragment>

			<div class="flex items-center justify-between text-xs">
				<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
					<Layers size={11} />Qualities
				</span>
				<span class="font-mono text-neutral-900 dark:text-neutral-100">
					{config.quality_count}
				</span>
			</div>
		</Card>
	{/each}
</CardGrid>
