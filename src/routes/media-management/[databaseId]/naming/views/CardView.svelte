<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Card from '$ui/card/Card.svelte';
	import Label from '$ui/label/Label.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Copy, Download } from 'lucide-svelte';
	import type { NamingListItem } from '$shared/pcd/display.ts';
	import radarrLogo from '$lib/client/assets/Radarr.svg';
	import sonarrLogo from '$lib/client/assets/Sonarr.svg';
	import { FEATURES } from '$shared/features.ts';

	export let configs: NamingListItem[];
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
</script>

<CardGrid columns={1} flush>
	{#each configs as config}
		<Card
			href="/media-management/{databaseId}/naming/{config.arr_type}/{encodeURIComponent(
				config.name
			)}"
			hoverable
		>
			<div class="flex items-center gap-4">
				<!-- Logo + Name -->
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div class="relative h-10 w-10 flex-shrink-0">
						{#if !loadedImages.has(config.name)}
							<div
								class="absolute inset-0 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"
							></div>
						{/if}
						<img
							src={logos[config.arr_type]}
							alt="{config.arr_type} logo"
							class="h-10 w-10 rounded-lg {loadedImages.has(config.name)
								? 'opacity-100'
								: 'opacity-0'}"
							on:load={() => handleImageLoad(config.name)}
						/>
					</div>
					<div class="min-w-0">
						<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{config.name}
						</h3>
						<div class="mt-1">
							{#if config.rename}
								<Label variant="success" size="sm" rounded="md">Rename Enabled</Label>
							{:else}
								<Label variant="secondary" size="sm" rounded="md">Rename Disabled</Label>
							{/if}
						</div>
					</div>
				</div>

				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center gap-0.5" on:click|stopPropagation|preventDefault>
					{#if FEATURES.importExport}
						<Button
							icon={Download}
							size="xs"
							variant="ghost"
							tooltip="Export"
							on:click={() => dispatch('export', { name: config.name, arr_type: config.arr_type })}
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
		</Card>
	{/each}
</CardGrid>
