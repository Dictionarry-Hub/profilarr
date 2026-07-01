<script lang="ts">
	import type { ComponentType } from 'svelte';

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
	export let icon: ComponentType | null = null;
	export let mono: boolean = false;

	const variantClasses: Record<typeof variant, string> = {
		accent: 'bg-surface-hover text-accent-solid',
		neutral: 'bg-surface-hover text-text-soft ',
		success: 'bg-success-bg text-success-text ',
		warning: 'bg-warning-bg text-warning-text ',
		danger: 'bg-danger-bg text-danger-text ',
		info: 'bg-info-bg text-info-text ',
		radarr: 'text-text ',
		sonarr: 'text-text '
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
	class="inline-flex items-center gap-1 rounded-control-sm font-medium {variantClasses[
		variant
	]} {sizeClasses[size]} {mono ? 'font-mono' : ''}"
>
	{#if icon}
		<svelte:component this={icon} size={iconSize} />
	{/if}
	<slot />
</span>
