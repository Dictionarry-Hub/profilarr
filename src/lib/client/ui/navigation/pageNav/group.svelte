<script lang="ts">
	import GroupHeader from './groupHeader.svelte';
	import type { ComponentType } from 'svelte';
	import { slide } from 'svelte/transition';

	export let label: string;
	export let href: string;
	export let icon: ComponentType | undefined = undefined;
	export let emoji: string | undefined = undefined;
	export let initialOpen: boolean = true;
	export let hasItems: boolean = false;
	export let onboardingId: string | undefined = undefined;

	let isOpen = initialOpen;

	function toggleOpen() {
		isOpen = !isOpen;
	}
</script>

<div class="mb-4" data-onboarding={onboardingId}>
	<GroupHeader {label} {href} {icon} {emoji} {isOpen} {hasItems} onToggle={toggleOpen} />

	{#if isOpen && hasItems}
		<div class="mt-2 grid grid-cols-[auto_1fr]" transition:slide={{ duration: 200 }}>
			<!-- Column 1: Vertical line -->
			<div class="flex justify-center px-5">
				<div class="w-0.5 rounded-full bg-neutral-300 dark:bg-neutral-700"></div>
			</div>

			<!-- Column 2: Items -->
			<div class="-ml-3 flex flex-col gap-1">
				<slot />
			</div>
		</div>
	{/if}
</div>
