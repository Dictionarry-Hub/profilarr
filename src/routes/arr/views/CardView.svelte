<script lang="ts">
	import { ExternalLink, Unlink } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Label from '$ui/label/Label.svelte';
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

	// Handle delete click
	function handleDeleteClick(e: MouseEvent, instance: ArrInstancePublic) {
		e.stopPropagation();
		e.preventDefault();
		dispatch('delete', instance);
	}

	function handleExternalClick(e: MouseEvent, url: string) {
		e.stopPropagation();
		e.preventDefault();
		window.open(url, '_blank');
	}
</script>

<CardGrid columns={1} flush>
	{#each instances as instance}
		<Card href="/arr/{instance.id}" hoverable>
			<div class="flex items-center gap-4">
				<!-- Left: Logo + Name -->
				<div class="flex min-w-0 flex-1 items-center gap-3">
					<div class="relative h-10 w-10 flex-shrink-0">
						{#if !loadedImages.has(instance.id)}
							<div
								class="absolute inset-0 animate-pulse rounded-lg bg-neutral-200 dark:bg-neutral-700"
							></div>
						{/if}
						<img
							src={getLogoPath(instance.type)}
							alt={`${instance.type} logo`}
							class="h-10 w-10 rounded-lg {loadedImages.has(instance.id)
								? 'opacity-100'
								: 'opacity-0'}"
							on:load={() => handleImageLoad(instance.id)}
						/>
					</div>
					<div class="min-w-0">
						<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
							{instance.name}
						</h3>
						<div class="mt-1 flex flex-col items-start gap-1">
							{#if instance.enabled}
								<Label variant="success" size="sm" rounded="md">Enabled</Label>
							{:else}
								<Label variant="secondary" size="sm" rounded="md">Disabled</Label>
							{/if}
							<Label variant="secondary" size="sm" rounded="md" mono>{instance.url}</Label>
						</div>
					</div>
				</div>

				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex flex-shrink-0 items-center gap-1" on:click|stopPropagation|preventDefault>
					<Button
						icon={ExternalLink}
						size="xs"
						variant="secondary"
						title="Open in Arr"
						ariaLabel="Open in Arr"
						on:click={(e) => handleExternalClick(e, instance.url)}
					/>
					<Button
						icon={Unlink}
						size="xs"
						variant="secondary"
						iconColor="text-red-600 dark:text-red-400"
						title="Unlink instance"
						ariaLabel="Unlink instance"
						on:click={(e) => handleDeleteClick(e, instance)}
					/>
				</div>
			</div>
		</Card>
	{/each}
</CardGrid>
