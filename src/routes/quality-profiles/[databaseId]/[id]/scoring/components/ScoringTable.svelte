<script lang="ts">
	import { onMount, onDestroy } from 'svelte';

	export let databaseId: number;
	export let formats: any[];
	export let arrTypes: string[];
	export let customFormatScores: Record<string, Record<string, number | null>>;
	export let customFormatEnabled: Record<string, Record<string, boolean>>;
	type IconCheckboxColor =
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})`;
	export let getArrTypeColor: (arrType: string) => IconCheckboxColor;
	export let title: string | null = null;
	export let firstRowOnboarding: string | undefined = undefined;

	import ScoringTableDesktop from './ScoringTableDesktop.svelte';
	import ScoringTableMobile from './ScoringTableMobile.svelte';

	let isDesktop = true;
	let mediaQuery: MediaQueryList | null = null;

	function handleMediaChange(e: MediaQueryListEvent) {
		isDesktop = e.matches;
	}

	onMount(() => {
		if (typeof window !== 'undefined') {
			mediaQuery = window.matchMedia('(min-width: 768px)');
			isDesktop = mediaQuery.matches;
			mediaQuery.addEventListener('change', handleMediaChange);
		}
	});

	onDestroy(() => {
		if (mediaQuery) {
			mediaQuery.removeEventListener('change', handleMediaChange);
		}
	});
</script>

{#if title}
	<div class="mb-3">
		<h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h3>
	</div>
{/if}

{#if isDesktop}
	<ScoringTableDesktop
		{databaseId}
		{formats}
		{arrTypes}
		{customFormatScores}
		{customFormatEnabled}
		{getArrTypeColor}
		{firstRowOnboarding}
		on:scoreChange
		on:enabledChange
	/>
{:else}
	<ScoringTableMobile
		{databaseId}
		{formats}
		{arrTypes}
		{customFormatScores}
		{customFormatEnabled}
		{getArrTypeColor}
		{firstRowOnboarding}
		on:scoreChange
		on:enabledChange
	/>
{/if}
