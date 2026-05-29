<script lang="ts">
	import { accentStore, accentColors, type AccentColor } from '$stores/accent';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Check, Circle } from 'lucide-svelte';

	export let onboarding: string | undefined = undefined;

	let open = false;
	let triggerEl: HTMLElement;

	function toggleOpen(event: MouseEvent) {
		event.stopPropagation();
		open = !open;
	}

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

<div class="accent-picker relative" data-onboarding={onboarding} bind:this={triggerEl}>
	<Button
		icon={Circle}
		iconColor="fill-accent-solid text-transparent"
		variant="ghost"
		size="md"
		ariaLabel="Select accent color"
		on:click={toggleOpen}
	/>

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
