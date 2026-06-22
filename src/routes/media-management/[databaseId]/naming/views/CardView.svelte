<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Card from '$ui/card/Card.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Copy, Download, Pencil, Ban, Replace, List } from 'lucide-svelte';
	import type { NamingListItem } from '$shared/pcd/display.ts';
	import {
		getMultiEpisodeStyleLabel,
		type SonarrColonReplacementFormat
	} from '$shared/pcd/mediaManagement.ts';
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

	function getConfigHref(config: NamingListItem): string {
		return `/media-management/${databaseId}/naming/${config.arr_type}/${encodeURIComponent(
			config.name
		)}`;
	}

	function formatColonReplacement(value: SonarrColonReplacementFormat): string {
		switch (value) {
			case 'delete':
				return 'Delete';
			case 'dash':
				return 'Dash';
			case 'spaceDash':
				return 'Space dash';
			case 'spaceDashSpace':
				return 'Space dash space';
			case 'smart':
				return 'Smart';
			case 'custom':
				return 'Custom';
		}
	}
</script>

<CardGrid columns={3} flush>
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

			<div class="space-y-1">
				<div class="flex items-center justify-between text-xs">
					<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
						<Pencil size={11} />Rename
					</span>
					<span class="font-mono text-neutral-900 dark:text-neutral-100">
						{config.rename ? '✓' : '✗'}
					</span>
				</div>
				<div class="flex items-center justify-between text-xs">
					<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
						<Ban size={11} />Illegal characters
					</span>
					<span class="font-mono text-neutral-900 dark:text-neutral-100">
						{config.replace_illegal_characters ? '✓' : '✗'}
					</span>
				</div>
				{#if config.replace_illegal_characters}
					<div class="flex items-center justify-between gap-2 text-xs">
						<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
							<Replace size={11} />Colon replacement
						</span>
						<span class="truncate font-mono text-neutral-900 dark:text-neutral-100">
							{formatColonReplacement(config.colon_replacement_format)}
						</span>
					</div>
				{/if}
				{#if config.arr_type === 'sonarr' && config.multi_episode_style !== null}
					<div class="flex items-center justify-between gap-2 text-xs">
						<span class="flex items-center gap-1.5 text-neutral-500 dark:text-neutral-400">
							<List size={11} />Multi-episode
						</span>
						<span class="truncate font-mono text-neutral-900 dark:text-neutral-100">
							{getMultiEpisodeStyleLabel(config.multi_episode_style)}
						</span>
					</div>
				{/if}
			</div>
		</Card>
	{/each}
</CardGrid>
