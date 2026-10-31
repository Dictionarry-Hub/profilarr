<script lang="ts">
	import ExternalLink from '@lucide/svelte/icons/external-link';
	import Unlink from '@lucide/svelte/icons/unlink';
	import TestTubeDiagonal from '@lucide/svelte/icons/test-tube-diagonal';
	import Check from '@lucide/svelte/icons/check';
	import Button from '#ui/button/Button.svelte';
	import Card from '#ui/card/Card.svelte';
	import CardGrid from '#ui/card/CardGrid.svelte';
	import Tooltip from '#ui/tooltip/Tooltip.svelte';
	import { isExperimentalVersion } from '#shared/arr/capabilities.ts';
	import { formatRelative } from '#shared/utils/dates.ts';
	import { getDisplayUrl } from '#client/utils/arrDisplayUrl.ts';
	import type { ArrInstanceSummary } from '#routes/arr/+page.server.ts';
	import { getCardLines, lineToneClass } from './cardLines.ts';
	import radarrLogo from '#client/assets/Radarr.svg';
	import sonarrLogo from '#client/assets/Sonarr.svg';
	import { createEventDispatcher } from 'svelte';

	export let instances: ArrInstanceSummary[];
	/** Row keys to show, from the card rows picker. */
	export let visibleRows: readonly string[];

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

	/** host[:port][/path] without the scheme, for the line under the name. */
	function formatAddress(instance: ArrInstanceSummary): string {
		return getDisplayUrl(instance).replace(/^https?:\/\//, '');
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

<CardGrid columns={1} className="md:grid-cols-2 xl:grid-cols-4" flush>
	{#each instances as instance}
		<Card href="/arr/{instance.id}" hoverable>
			<svelte:fragment slot="header">
				<!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
				<div class="flex items-center justify-between gap-2">
					<div class="flex min-w-0 items-center gap-2.5">
						<div class="relative h-8 w-8 flex-shrink-0">
							{#if !loadedImages.has(instance.id)}
								<div
									class="absolute inset-0 animate-pulse rounded bg-neutral-200 dark:bg-neutral-700"
								></div>
							{/if}
							<img
								src={getLogoPath(instance.type)}
								alt={`${instance.type} logo`}
								class="h-8 w-8 rounded {loadedImages.has(instance.id)
									? 'opacity-100'
									: 'opacity-0'}"
								on:load={() => handleImageLoad(instance.id)}
								use:checkLoaded={instance.id}
							/>
						</div>
						<div class="min-w-0">
							<h3 class="truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
								{instance.name}
							</h3>
							<p class="truncate text-xs text-neutral-500 dark:text-neutral-400">
								{formatAddress(instance)}
							</p>
						</div>
					</div>
					<div class="flex shrink-0 items-center gap-0.5" on:click|stopPropagation|preventDefault>
						{#if isExperimentalVersion(instance)}
							<Tooltip text="Experimental">
								<span
									role="img"
									aria-label="Experimental"
									class="flex p-1.5 text-blue-600 dark:text-blue-400"
								>
									<TestTubeDiagonal size={12} />
								</span>
							</Tooltip>
						{/if}
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
							iconColor="text-red-600 dark:text-red-400"
							tooltip="Unlink instance"
							on:click={(e) => handleDeleteClick(e, instance)}
						/>
					</div>
				</div>
			</svelte:fragment>

			<!-- Label | value | "· next run". The shared third column lines the dots up;
			     a row without a next run lets its value span to the card edge. -->
			<div class="grid grid-cols-[auto_1fr_auto] items-center gap-y-1 text-xs">
				{#each getCardLines(instance, visibleRows) as line (line.key)}
					<span class="flex items-center gap-1.5 pr-3 text-neutral-500 dark:text-neutral-400">
						<svelte:component this={line.icon} size={11} />{line.label}
					</span>
					<span
						class="flex min-w-0 items-center justify-end gap-1 truncate font-mono {line.nextAt
							? ''
							: 'col-span-2'}"
					>
						{#if line.check}<Check size={12} class={lineToneClass.ok} />{/if}
						<span class={lineToneClass[line.tone]}>{line.value}</span>
					</span>
					{#if line.nextAt}
						<span class="font-mono whitespace-nowrap text-neutral-400 dark:text-neutral-500">
							<span class="px-1">·</span>{formatRelative(line.nextAt)}
						</span>
					{/if}
				{/each}
			</div>
		</Card>
	{/each}
</CardGrid>
