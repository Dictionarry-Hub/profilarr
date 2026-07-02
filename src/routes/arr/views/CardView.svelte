<script lang="ts">
	import { ExternalLink, Unlink, ArrowUpCircle, Type, Trash2 } from 'lucide-svelte';
	import Button from '$ui/button/Button.svelte';
	import Card from '$ui/card/Card.svelte';
	import CardGrid from '$ui/card/CardGrid.svelte';
	import Label from '$ui/label/Label.svelte';
	import { getDisplayUrl } from '$lib/client/utils/arrDisplayUrl.ts';
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

	function handleDeleteClick(e: MouseEvent, instance: ArrInstanceSummary) {
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

<CardGrid columns={1} className="lg:grid-cols-2 2xl:grid-cols-3" flush>
	{#each instances as instance}
		<Card href="/arr/{instance.id}" hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2">
						<div class="relative h-6 w-6 flex-shrink-0">
							{#if !loadedImages.has(instance.id)}
								<div
									class="absolute inset-0 animate-pulse rounded-control-sm bg-surface-hover"
								></div>
							{/if}
							<img
								src={getLogoPath(instance.type)}
								alt={`${instance.type} logo`}
								class="h-6 w-6 rounded-control-sm {loadedImages.has(instance.id)
									? 'opacity-100'
									: 'opacity-0'}"
								on:load={() => handleImageLoad(instance.id)}
								use:checkLoaded={instance.id}
							/>
						</div>
						<h3 class="truncate text-sm font-semibold text-text">
							{instance.name}
						</h3>
					</div>
					<div class="flex shrink-0 items-center gap-0.5" on:click|stopPropagation|preventDefault>
						<Button
							icon={ExternalLink}
							size="xs"
							variant="ghost"
							tooltip="Open in {formatType(instance.type)}"
							on:click={(e) => handleExternalClick(e, getDisplayUrl(instance))}
						/>
						<Button
							icon={Unlink}
							size="xs"
							variant="ghost"
							iconColor="text-danger-icon"
							tooltip="Unlink instance"
							on:click={(e) => handleDeleteClick(e, instance)}
						/>
					</div>
				</div>
			</svelte:fragment>

			<div class="flex flex-1 flex-col gap-2">
				<div>
					<span class="text-xs font-medium text-text-muted">Quality Profiles:</span>
					{#if instance.syncedProfileNames.length > 0}
						<div class="mt-1 flex flex-wrap gap-1">
							{#each instance.syncedProfileNames as name}
								<Label variant="secondary" size="sm" radius="md">{name}</Label>
							{/each}
						</div>
					{:else}
						<span class="ml-1 text-xs text-text-subtle">None</span>
					{/if}
				</div>
				<div>
					<span class="text-xs font-medium text-text-muted">Delay Profile:</span>
					{#if instance.delayProfileName}
						<span class="ml-1"
							><Label variant="secondary" size="sm" radius="md">{instance.delayProfileName}</Label
							></span
						>
					{:else}
						<span class="ml-1 text-xs text-text-subtle">None</span>
					{/if}
				</div>
				<div>
					<span class="text-xs font-medium text-text-muted">Media Management:</span>
					{#if instance.namingConfigName || instance.qualityDefinitionsConfigName || instance.mediaSettingsConfigName}
						<div class="mt-1 flex flex-wrap gap-1">
							{#if instance.namingConfigName}
								<Label variant="secondary" size="sm" radius="md"
									>Naming: {instance.namingConfigName}</Label
								>
							{/if}
							{#if instance.qualityDefinitionsConfigName}
								<Label variant="secondary" size="sm" radius="md"
									>Quality Definitions: {instance.qualityDefinitionsConfigName}</Label
								>
							{/if}
							{#if instance.mediaSettingsConfigName}
								<Label variant="secondary" size="sm" radius="md"
									>Media Settings: {instance.mediaSettingsConfigName}</Label
								>
							{/if}
						</div>
					{:else}
						<span class="ml-1 text-xs text-text-subtle">None</span>
					{/if}
				</div>
			</div>

			<svelte:fragment slot="footer">
				<div
					class="flex flex-col items-start gap-1.5 text-xs text-text-soft sm:flex-row sm:items-center sm:gap-3"
				>
					<div class="flex items-center gap-1">
						<ArrowUpCircle size={12} class="text-warning-icon" />
						<span>Upgrades: {instance.upgradeEnabled ? 'On' : 'Off'}</span>
					</div>
					<span class="hidden text-text sm:inline">&middot;</span>
					<div class="flex items-center gap-1">
						<Type size={12} class="text-info-icon" />
						<span>Renames: {instance.renameEnabled ? 'On' : 'Off'}</span>
					</div>
					<span class="hidden text-text sm:inline">&middot;</span>
					<div class="flex items-center gap-1">
						<Trash2 size={12} class="text-danger-icon" />
						<span>Cleanup: {instance.cleanupEnabled ? 'On' : 'Off'}</span>
					</div>
				</div>
			</svelte:fragment>
		</Card>
	{/each}
</CardGrid>
