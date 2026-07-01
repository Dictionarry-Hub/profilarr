<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { Check } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';

	export let checked: boolean = false;
	export let disabled: boolean = false;
	export let icon: ComponentType = Check;
	export let checkColor:
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})` = 'accent';
</script>

<button
	type="button"
	class="flex w-full items-center justify-between gap-3 bg-surface p-3 text-left transition-colors {disabled
		? 'cursor-not-allowed opacity-50'
		: 'cursor-pointer hover:bg-surface-muted '}"
	{disabled}
	on:click
>
	<div class="min-w-0 flex-1">
		<slot />
	</div>
	<IconCheckbox {checked} {icon} color={checkColor} />
</button>
