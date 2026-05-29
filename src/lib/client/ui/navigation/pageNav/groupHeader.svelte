<script lang="ts">
	import { page } from '$app/stores';
	import type { ComponentType } from 'svelte';
	import Label from '$ui/label/Label.svelte';

	export let label: string;
	export let href: string;
	export let icon: ComponentType | undefined = undefined;
	export let emoji: string | undefined = undefined;
	export let isOpen: boolean;
	export let hasItems: boolean;
	export let onToggle: () => void;
	export let alert: number = 0;

	$: isActive = $page.url.pathname === href || $page.url.pathname.startsWith(href + '/');
</script>

<div
	class="group/header flex items-center rounded-control border {isActive
		? 'border-border bg-surface shadow-control'
		: 'border-transparent'}"
>
	<!-- Main navigation button (left side) - rounded left, square right (or fully rounded if no items) -->
	<a
		{href}
		class="flex flex-1 items-center gap-2 py-1.5 pr-2 pl-3 font-sans text-sm font-semibold text-text-soft transition-colors {isActive
			? ''
			: 'group-hover/header:bg-surface-hover hover:bg-surface-hover'} {hasItems
			? 'rounded-l-control'
			: 'rounded-control'}"
	>
		{#if emoji}
			<span class="nav-icon-emoji">{emoji}</span>
		{/if}
		{#if icon}
			<span class="nav-icon-lucide"><svelte:component this={icon} class="h-4 w-4" /></span>
		{/if}
		<span class="flex-1">{label}</span>
		{#if alert > 0}
			<Label variant="info" size="sm" rounded="full">{alert}</Label>
		{/if}
	</a>

	<!-- Chevron toggle button (right side) - square left, rounded right -->
	{#if hasItems}
		<button
			onclick={onToggle}
			class="flex items-center self-stretch rounded-r-control pr-1.5 pl-1.5 transition-colors {isActive
				? 'hover:!bg-surface-hover'
				: 'group-hover/header:bg-surface-hover hover:!bg-surface-hover-muted'}"
			aria-label={isOpen ? 'Collapse group' : 'Expand group'}
		>
			<svg
				class="h-4 w-4 text-text-muted transition-transform {isOpen ? 'rotate-90' : ''}"
				fill="none"
				stroke="currentColor"
				viewBox="0 0 24 24"
			>
				<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
			</svg>
		</button>
	{/if}
</div>
