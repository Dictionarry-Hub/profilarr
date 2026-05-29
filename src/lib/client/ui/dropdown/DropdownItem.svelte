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
	export let highlighted: boolean = false;
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
	export let customContent: boolean = false;

	$: sizeClasses = compact ? 'gap-2 px-2 py-1 text-xs' : 'gap-3 px-3 py-2';

	$: rowRoundingClasses = compact
		? 'first:rounded-t-control-sm last:rounded-b-control-sm'
		: 'first:rounded-t-control last:rounded-b-control';

	$: stateClasses = disabled
		? 'cursor-not-allowed text-text-subtle'
		: danger
			? `text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900 ${highlighted ? 'bg-red-50 dark:bg-red-900' : ''}`
			: `text-text-soft hover:bg-surface-hover ${highlighted ? 'bg-surface-hover' : ''}`;

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
	class="flex w-full items-center border-b border-border-subtle last:border-b-0 {rowRoundingClasses}"
>
	<button
		class="flex min-w-0 flex-1 items-center text-left transition-colors {sizeClasses} {stateClasses}"
		{disabled}
		on:click
		on:mouseenter
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
		{#if customContent}
			<span class="min-w-0 flex-1 {labelClass}">
				<slot />
			</span>
		{:else}
			<span class="flex-1 {labelTransformClass} {labelClass}"
				>{label}{#if secondaryText}<span class="ml-1.5 text-xs text-text-subtle"
						>{secondaryText}</span
					>{/if}</span
			>
		{/if}
		<IconCheckbox icon={checkIcon} checked={selected} shape="circle" color={checkColor} {compact} />
	</button>
	{#if $$slots.actions}
		<div class="flex items-center {compact ? 'pr-2' : 'pr-3'}">
			<slot name="actions" />
		</div>
	{/if}
</div>
