<script lang="ts">
	import { themePreference } from '$stores/theme.ts';
	import Parrot from './characters/Parrot.svelte';
	import Clippy from './characters/Clippy.svelte';
	import Joi from './characters/Joi.svelte';
	import Oracle from './characters/Oracle.svelte';

	export let variant: 'fab' | 'navbar' = 'fab';

	let open = false;

	function toggle() {
		open = !open;
	}

	function close() {
		open = false;
	}

	$: isFab = variant === 'fab';
</script>

<svelte:window on:click={close} />

<!-- svelte-ignore a11y-click-events-have-key-events -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div
	data-onboarding={isFab ? 'help-button' : undefined}
	class={isFab ? 'fixed right-6 bottom-6 z-50 hidden md:block' : 'relative md:hidden'}
	on:click|stopPropagation
>
	{#if $themePreference === 'ashruvarsha'}
		<Joi {variant} {open} onToggle={toggle} onClose={close} />
	{:else if $themePreference === 'vesper'}
		<Oracle {variant} {open} onToggle={toggle} onClose={close} />
	{:else if $themePreference === 'retro'}
		<Clippy {variant} {open} onToggle={toggle} onClose={close} />
	{:else}
		<Parrot {variant} {open} onToggle={toggle} onClose={close} />
	{/if}
</div>
