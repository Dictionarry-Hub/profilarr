<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { Check } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';

	export let icon: ComponentType | { path: string } | undefined = undefined;

	$: isSvgIcon = icon && typeof icon === 'object' && 'path' in icon;
	export let label: string;
	export let disabled: boolean = false;
	export let danger: boolean = false;
	export let selected: boolean = false;
	export let compact: boolean = false;

	$: sizeClasses = compact
		? 'gap-2 px-2 py-1 text-xs first:rounded-t-lg last:rounded-b-lg'
		: 'gap-3 px-3 py-2 first:rounded-t-xl last:rounded-b-xl';

	$: stateClasses = disabled
		? 'cursor-not-allowed text-neutral-400 dark:text-neutral-500'
		: danger
			? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900'
			: 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700';

	$: baseSurfaceClass = 'bg-white dark:bg-neutral-800';

	$: iconSize = compact ? 12 : 16;
</script>

<button
	class="flex w-full items-center border-b border-neutral-200 text-left transition-colors last:border-b-0 dark:border-neutral-700/60 {baseSurfaceClass} {sizeClasses} {stateClasses}"
	{disabled}
	on:click
>
	{#if icon}
		{#if isSvgIcon}
			<svg role="img" viewBox="0 0 24 24" fill="currentColor" width={iconSize} height={iconSize}>
				<path d={(icon as { path: string }).path} />
			</svg>
		{:else}
			<svelte:component this={icon as ComponentType} size={iconSize} />
		{/if}
	{/if}
	<span class="flex-1">{label}</span>
	<IconCheckbox icon={Check} checked={selected} shape="circle" color="accent" />
</button>
