<script lang="ts">
	import type { ComponentType } from 'svelte';
	import { Check } from 'lucide-svelte';
	import IconCheckbox from '$ui/form/IconCheckbox.svelte';

	export let icon: ComponentType | { path: string } | undefined = undefined;

	$: isSvgIcon = icon && typeof icon === 'object' && 'path' in icon;
	export let label: string;
	export let secondaryText: string = '';
	export let disabled: boolean = false;
	export let danger: boolean = false;
	export let selected: boolean = false;
	export let compact: boolean = false;
	export let checkIcon: ComponentType = Check;
	export let checkColor:
		| 'accent'
		| 'blue'
		| 'green'
		| 'red'
		| 'neutral'
		| `#${string}`
		| `var(--${string})` = 'accent';
	export let labelClass: string = '';
	export let labelTransform: 'none' | 'capitalize' | 'uppercase' | 'lowercase' = 'none';

	$: sizeClasses = compact ? 'gap-2 px-2 py-1 text-xs' : 'gap-3 px-3 py-2';

	$: rowRoundingClasses = compact
		? 'first:rounded-t-lg last:rounded-b-lg'
		: 'first:rounded-t-xl last:rounded-b-xl';

	$: stateClasses = disabled
		? 'cursor-not-allowed text-neutral-400 dark:text-neutral-500'
		: danger
			? 'text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900'
			: 'text-neutral-700 hover:bg-neutral-50 dark:text-neutral-200 dark:hover:bg-neutral-700';

	$: iconSize = compact ? 12 : 16;
	$: labelTransformClass =
		labelTransform === 'capitalize'
			? 'capitalize'
			: labelTransform === 'uppercase'
				? 'uppercase'
				: labelTransform === 'lowercase'
					? 'lowercase'
					: '';
</script>

<div
	class="flex w-full items-center border-b border-neutral-200/50 last:border-b-0 dark:border-neutral-700/40 {rowRoundingClasses}"
>
	<button
		class="flex min-w-0 flex-1 items-center text-left transition-colors {sizeClasses} {stateClasses}"
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
		<span class="flex-1 {labelTransformClass} {labelClass}"
			>{label}{#if secondaryText}<span class="ml-1.5 text-xs text-neutral-400 dark:text-neutral-500"
					>{secondaryText}</span
				>{/if}</span
		>
		<IconCheckbox icon={checkIcon} checked={selected} shape="circle" color={checkColor} />
	</button>
	{#if $$slots.actions}
		<div class="flex items-center {compact ? 'pr-2' : 'pr-3'}">
			<slot name="actions" />
		</div>
	{/if}
</div>
