<script lang="ts">
	import { accentStore, accentColors, type AccentColor } from '$stores/accent';
	import Dropdown from '$ui/dropdown/Dropdown.svelte';
	import Button from '$ui/button/Button.svelte';
	import { Check, Circle } from 'lucide-svelte';
	import { browser } from '$app/environment';

	export let onboarding: string | undefined = undefined;
	export let fixedColor: string | undefined = undefined;
	export let themeAccents:
		| { label: string; color: string; hover: string; onAccent: string }[]
		| undefined = undefined;
	export let themeName: string | undefined = undefined;

	let open = false;
	let triggerEl: HTMLElement;
	let selectedThemeAccent: string | undefined = undefined;

	function storageKey(name: string) {
		return `themeAccent:${name}`;
	}

	function applyThemeAccent(color: string, hover: string, onAccent: string) {
		if (!browser) return;
		const root = document.documentElement;
		root.style.setProperty('--theme-accent-solid', color);
		root.style.setProperty('--theme-accent-solid-hover', hover);
		root.style.setProperty('--theme-on-accent', onAccent);
	}

	function clearThemeAccent() {
		if (!browser) return;
		const root = document.documentElement;
		root.style.removeProperty('--theme-accent-solid');
		root.style.removeProperty('--theme-accent-solid-hover');
		root.style.removeProperty('--theme-on-accent');
	}

	$: if (themeAccents && themeName && browser) {
		const saved = localStorage.getItem(storageKey(themeName));
		const match = saved ? themeAccents.find((a) => a.color === saved) : null;
		if (match) {
			selectedThemeAccent = match.color;
			applyThemeAccent(match.color, match.hover, match.onAccent);
		} else {
			selectedThemeAccent = themeAccents[0].color;
			clearThemeAccent();
		}
	} else if (!themeAccents && browser) {
		selectedThemeAccent = undefined;
		clearThemeAccent();
	}

	function toggleOpen(event: MouseEvent) {
		event.stopPropagation();
		open = !open;
	}

	function select(accent: AccentColor) {
		if (fixedColor) return;
		accentStore.set(accent);
		open = false;
	}

	function selectThemeAccent(accent: { color: string; hover: string; onAccent: string }) {
		if (!themeName) return;
		selectedThemeAccent = accent.color;
		applyThemeAccent(accent.color, accent.hover, accent.onAccent);
		if (browser) {
			localStorage.setItem(storageKey(themeName), accent.color);
		}
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
				{#if themeAccents}
					{#each themeAccents as accent}
						<button
							on:click|stopPropagation={() => selectThemeAccent(accent)}
							class="relative flex h-6 w-6 items-center justify-center rounded-pill transition-transform hover:scale-110"
							style="background-color: {accent.color}"
							aria-label={accent.label}
						>
							{#if selectedThemeAccent === accent.color}
								<Check size={14} class="text-on-accent" />
							{/if}
						</button>
					{/each}
				{:else if fixedColor}
					<div
						class="relative flex h-6 w-6 items-center justify-center rounded-pill"
						style="background-color: {fixedColor}"
					>
						<Check size={14} class="text-on-accent" />
					</div>
				{:else}
					{#each accentColors as accent}
						<button
							on:click|stopPropagation={() => select(accent.value)}
							class="relative flex h-6 w-6 items-center justify-center rounded-pill transition-transform hover:scale-110"
							style="background-color: {accent.color}"
							aria-label={accent.label}
						>
							{#if $accentStore === accent.value}
								<Check size={14} class="text-on-accent" />
							{/if}
						</button>
					{/each}
				{/if}
			</div>
		</Dropdown>
	{/if}
</div>
