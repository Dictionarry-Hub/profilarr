<script lang="ts">
	import { accentStore, accentColors, type AccentColor } from '$stores/accent';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import { Check } from 'lucide-svelte';

	let open = false;
	let triggerEl: HTMLElement;

	$: currentColor = accentColors.find((c) => c.value === $accentStore) ?? accentColors[0];

	function select(accent: AccentColor) {
		accentStore.set(accent);
		open = false;
	}

	function handleClickOutside(event: MouseEvent) {
		const target = event.target as HTMLElement;
		if (!target.closest('.accent-picker')) {
			open = false;
		}
	}
</script>

<svelte:window on:click={handleClickOutside} />

<div class="accent-picker relative" data-onboarding="accent-picker">
	<button
		bind:this={triggerEl}
		on:click|stopPropagation={() => (open = !open)}
		class="flex h-9 w-9 items-center justify-center rounded-md transition-colors hover:bg-neutral-200 dark:hover:bg-neutral-800"
		aria-label="Select accent color"
	>
		<span class="h-4 w-4 rounded-full" style="background-color: {currentColor.color}"></span>
	</button>

	{#if open}
		<Dropdown position="middle" minWidth="auto" fixed={true} {triggerEl}>
			<div class="flex flex-col gap-2 p-2">
				{#each accentColors as accent}
					<button
						on:click|stopPropagation={() => select(accent.value)}
						class="relative flex h-6 w-6 items-center justify-center rounded-full transition-transform hover:scale-110"
						style="background-color: {accent.color}"
						aria-label={accent.label}
					>
						{#if $accentStore === accent.value}
							<Check size={14} class="text-white" />
						{/if}
					</button>
				{/each}
			</div>
		</Dropdown>
	{/if}
</div>
