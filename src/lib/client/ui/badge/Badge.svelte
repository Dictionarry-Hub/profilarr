<script lang="ts">
	import type { Component } from 'svelte';

	export let variant:
		| 'accent'
		| 'neutral'
		| 'success'
		| 'warning'
		| 'danger'
		| 'info'
		| 'radarr'
		| 'sonarr' = 'accent';
	export let size: 'sm' | 'md' = 'sm';
	export let icon: Component | null = null;
	export let mono: boolean = false;

	const variantClasses: Record<typeof variant, string> = {
		accent: 'bg-accent-100 text-accent-800 dark:bg-accent-900 dark:text-accent-200',
		neutral: 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300',
		success: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
		warning: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
		danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
		info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
		radarr: 'text-neutral-900 dark:text-neutral-100',
		sonarr: 'text-neutral-900 dark:text-neutral-100'
	};

	const sizeClasses: Record<typeof size, string> = {
		sm: 'px-1.5 py-0.5 text-[10px]',
		md: 'px-2 py-0.5 text-xs'
	};

	$: iconSize = size === 'sm' ? 10 : 12;
	$: styleAttr =
		variant === 'radarr'
			? 'background-color: var(--arr-radarr-color); color: #111827;'
			: variant === 'sonarr'
				? 'background-color: var(--arr-sonarr-color); color: #111827;'
				: '';
</script>

<span
	style={styleAttr}
	class="inline-flex items-center gap-1 rounded font-medium {variantClasses[variant]} {sizeClasses[
		size
	]} {mono ? 'font-mono' : ''}"
>
	{#if icon}
		<svelte:component this={icon} size={iconSize} />
	{/if}
	<slot />
</span>
